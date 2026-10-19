import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api";
import {
  fetchOpsBooking,
  fetchOpsBookings,
  fetchOpsDrivers,
  fetchOpsSummary,
  opsCancel,
  retryDispatch,
  wsUrl,
  type OpsDetail,
  type OpsDriverRow,
  type OpsList,
  type OpsSummary,
} from "./opsApi";
import { getAccessToken } from "./session";

type Props = {
  canReadDispatch: boolean;
  canRetry: boolean;
  canCancel: boolean;
  canReadDrivers: boolean;
};

function shortId(id: string) {
  return id.length > 12 ? `${id.slice(0, 8)}…` : id;
}

function money(paise: number, currency: string) {
  return `${currency} ${(paise / 100).toFixed(2)}`;
}

export function OpsDashboard({
  canReadDispatch,
  canRetry,
  canCancel,
  canReadDrivers,
}: Props) {
  const [summary, setSummary] = useState<OpsSummary | null>(null);
  const [list, setList] = useState<OpsList | null>(null);
  const [drivers, setDrivers] = useState<OpsDriverRow[]>([]);
  const [detail, setDetail] = useState<OpsDetail | null>(null);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [wsState, setWsState] = useState("off");
  const wsRef = useRef<WebSocket | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", "15");
      if (status) params.set("status", status);
      if (q.trim()) params.set("q", q.trim());
      if (createdFrom) params.set("created_from", new Date(createdFrom).toISOString());
      if (createdTo) params.set("created_to", new Date(createdTo).toISOString());
      const tasks: Promise<unknown>[] = [fetchOpsSummary(), fetchOpsBookings(params)];
      if (canReadDrivers) {
        const dp = new URLSearchParams({ page: "1", page_size: "25" });
        tasks.push(fetchOpsDrivers(dp));
      }
      const results = await Promise.all(tasks);
      setSummary(results[0] as OpsSummary);
      setList(results[1] as OpsList);
      if (canReadDrivers && results[2]) {
        setDrivers((results[2] as { items: OpsDriverRow[] }).items);
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : "Failed to load bookings");
      }
    } finally {
      setLoading(false);
    }
  }, [page, status, q, createdFrom, createdTo, canReadDrivers]);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) return;
    const ws = new WebSocket(wsUrl(access));
    wsRef.current = ws;
    ws.onopen = () => setWsState("connected");
    ws.onclose = () => setWsState("disconnected");
    ws.onerror = () => setWsState("error");
    ws.onmessage = () => {
      void loadList();
      if (detail) {
        void fetchOpsBooking(detail.id)
          .then(setDetail)
          .catch(() => undefined);
      }
    };
    return () => {
      ws.close();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openDetail(id: string) {
    setActionMsg(null);
    try {
      const d = await fetchOpsBooking(id);
      setDetail(d);
      const access = getAccessToken();
      if (access && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(
          JSON.stringify({ action: "subscribe.booking", booking_id: id }),
        );
      }
    } catch (err) {
      setActionMsg(err instanceof Error ? err.message : "Detail failed");
    }
  }

  async function onRetry() {
    if (!detail || !canRetry) return;
    if (!window.confirm("Retry dispatch for this booking?")) return;
    setActionMsg(null);
    try {
      const res = await retryDispatch(detail.id);
      setActionMsg(`Retry OK → ${res.status}`);
      await openDetail(detail.id);
      await loadList();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setActionMsg(code || (err instanceof Error ? err.message : "Retry failed"));
    }
  }

  async function onCancel() {
    if (!detail || !canCancel) return;
    if (!window.confirm("Cancel this booking? This cannot be undone from the portal.")) {
      return;
    }
    const reason = window.prompt("Cancel reason (optional)", "ops_cancel") || "ops_cancel";
    setActionMsg(null);
    try {
      const res = await opsCancel(detail.id, reason);
      setActionMsg(`Cancelled → ${res.status}`);
      await openDetail(detail.id);
      await loadList();
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      setActionMsg(code || (err instanceof Error ? err.message : "Cancel failed"));
    }
  }

  function onFilter(e: FormEvent) {
    e.preventDefault();
    setPage(1);
    void loadList();
  }

  if (forbidden) {
    return (
      <section className="panel">
        <p className="warn">You do not have permission to view operations bookings.</p>
      </section>
    );
  }

  return (
    <section className="ops">
      <div className="ops-toolbar">
        <h2>Dispatch center</h2>
        <p className="muted">Live: {wsState} · refresh uses API as source of truth</p>
        <button type="button" onClick={() => void loadList()}>
          Refresh
        </button>
      </div>

      {summary && (
        <div className="status-grid" aria-label="Booking counts by status">
          <div className="stat">
            <span className="stat-label">Total</span>
            <span className="stat-value">{summary.total}</span>
          </div>
          {Object.entries(summary.by_status)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, count]) => (
              <button
                key={key}
                type="button"
                className={`stat ${status === key ? "active" : ""}`}
                onClick={() => {
                  setStatus(status === key ? "" : key);
                  setPage(1);
                }}
              >
                <span className="stat-label">{key}</span>
                <span className="stat-value">{count}</span>
              </button>
            ))}
        </div>
      )}

      <form className="filters" onSubmit={onFilter}>
        <label>
          Search
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Booking / customer / driver UUID or email"
          />
        </label>
        <label>
          Status
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="e.g. SEARCHING_DRIVER" />
        </label>
        <label>
          From
          <input type="date" value={createdFrom} onChange={(e) => setCreatedFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="date" value={createdTo} onChange={(e) => setCreatedTo(e.target.value)} />
        </label>
        <button type="submit">Apply</button>
      </form>

      {loading && <p>Loading bookings…</p>}
      {error && (
        <p className="warn">
          {error}{" "}
          <button type="button" onClick={() => void loadList()}>
            Retry
          </button>
        </p>
      )}

      {!loading && list && list.items.length === 0 && (
        <p className="muted">No bookings match these filters.</p>
      )}

      {list && list.items.length > 0 && (
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Fare</th>
                <th>Offers</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {list.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <button type="button" className="linkish" onClick={() => void openDetail(row.id)}>
                      {shortId(row.id)}
                    </button>
                  </td>
                  <td>{row.status}</td>
                  <td title={row.customer_id}>
                    {row.customer_email || shortId(row.customer_id)}
                  </td>
                  <td>{money(row.estimate_paise, row.currency)}</td>
                  <td>{row.open_offer_count}</td>
                  <td>{new Date(row.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="pager">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Prev
            </button>
            <span className="muted">
              Page {list.page} · {list.total} total
            </span>
            <button
              type="button"
              disabled={page * list.page_size >= list.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {canReadDrivers && (
        <div className="panel">
          <h3>Driver readiness</h3>
          {drivers.length === 0 ? (
            <p className="muted">No driver profiles yet.</p>
          ) : (
            <div className="table-wrap">
              <table className="data">
                <thead>
                  <tr>
                    <th>Driver</th>
                    <th>Duty</th>
                    <th>Freshness</th>
                    <th>Eligible</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {drivers.map((d) => (
                    <tr key={d.driver_profile_id}>
                      <td title={d.driver_profile_id}>
                        {d.email || shortId(d.driver_profile_id)}
                      </td>
                      <td>
                        {d.is_online ? "online" : "offline"} / {d.duty_status}
                      </td>
                      <td>{d.location_freshness}</td>
                      <td>{d.dispatch_eligible ? "yes" : "no"}</td>
                      <td>{d.ineligibility_reason || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {detail && (
        <aside className="detail panel">
          <div className="ops-toolbar">
            <h3>Booking {shortId(detail.id)}</h3>
            <button type="button" className="ghost" onClick={() => setDetail(null)}>
              Close
            </button>
          </div>
          <p>
            <strong>{detail.status}</strong> · {detail.vehicle_type} ·{" "}
            {money(detail.estimate_paise, detail.currency)}
          </p>
          <p className="muted" title={detail.customer_id}>
            Customer: {detail.customer_email || shortId(detail.customer_id)}
          </p>
          <p className="muted">
            Pickup {detail.pickup_lat}, {detail.pickup_lon} → Drop {detail.drop_lat},{" "}
            {detail.drop_lon}
          </p>
          <p className="muted">
            Distance {detail.distance_km} km · {detail.duration_min} min
          </p>
          {canReadDispatch && detail.unassigned_reason && (
            <p className="warn">Unassigned: {detail.unassigned_reason}</p>
          )}
          {detail.assignment && (
            <p>
              Assignment {shortId(detail.assignment.id)} · driver{" "}
              {shortId(detail.assignment.driver_profile_id)} · {detail.assignment.status}
            </p>
          )}

          {canReadDispatch && (
            <>
              <h4>Offers</h4>
              {detail.offers.length === 0 ? (
                <p className="muted">No offers recorded.</p>
              ) : (
                <ul className="plain">
                  {detail.offers.map((o) => (
                    <li key={o.id}>
                      {o.status} · {shortId(o.driver_profile_id)}
                      {o.driver_online != null ? ` · online=${o.driver_online}` : ""}
                      {o.driver_last_lat != null
                        ? ` · loc ${o.driver_last_lat},${o.driver_last_lon}`
                        : ""}
                      <br />
                      <span className="muted">
                        created {new Date(o.created_at).toLocaleString()} · expires{" "}
                        {new Date(o.expires_at).toLocaleString()}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {Object.keys(detail.offer_counts).length > 0 && (
                <p className="muted">
                  Counts:{" "}
                  {Object.entries(detail.offer_counts)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(", ")}
                </p>
              )}
            </>
          )}

          <h4>Events</h4>
          <ul className="plain">
            {detail.events.map((e) => (
              <li key={e.id}>
                {e.from_status || "∅"} → {e.to_status}
                {e.reason ? ` (${e.reason})` : ""} ·{" "}
                <span className="muted">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>

          <div className="actions">
            {canRetry && (
              <button type="button" onClick={() => void onRetry()}>
                Retry dispatch
              </button>
            )}
            {canCancel && (
              <button type="button" className="danger" onClick={() => void onCancel()}>
                Cancel booking
              </button>
            )}
          </div>
          {actionMsg && <p className="warn">{actionMsg}</p>}
        </aside>
      )}
    </section>
  );
}
