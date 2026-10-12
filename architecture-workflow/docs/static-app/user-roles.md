# User-role inventory

| Role | Application | Entry (signed out) | Simulated sign-in | Main journeys |
| --- | --- | --- | --- | --- |
| Customer (rider) | `customer-app/` | R01 splash → R02 → R58 | Phone + OTP **482716**; demo accounts on R58 (existing: 98480 04321, new: 90000 00001). New numbers complete a profile (R05) and permissions (R06) | City ride, long trips, shared seats, buses, rentals, hotels, food, parcels, savings, wallet, history, notifications, help, SOS |
| Driver / delivery partner | `driver-app/` | D01 | Phone; code read automatically (simulated). 90000 12345 = existing driver Arjun K.; any other valid number starts registration (D02) | Onboarding and KYC, availability, ride offers and trips, deliveries with proof, long-trip seats, earnings, payouts, documents, support, SOS, offline sync |
| Partner (restaurant, hotel, rental, bus) | `patner-app/` | P08 | Business e-mail + code **482716** | Partner home, food orders (accept, prepare, ready, hand to courier), hotel bookings, rental handovers, bus boarding, menu, payouts and reviews, settings, complaints |
| Admin / operations staff | `admin/` | A01 | MFA code **730951**; demo role switch on A20 Roles & permissions (8 roles from architecture page 10), also in the connected demo | Monitoring, ride detail and timeline, manual dispatch, KYC review, pricing, zones, refunds, disputes, SOS, fraud, telephony, reports, audit, roles, configuration |
| Support agent (helps customers, drivers and partners) | `agent-portal/` G01–G13 (web portal) | G01 | Active agent account (created by the admin on A31) + code **246810**; suspended accounts are refused | Unified inbox, calls (softphone, IVR queue, hold, transfer, conference, wrap-up, call-backs, outbound), e-mail, social media (WhatsApp, Facebook, Instagram, X; move public posts to private), live chat and in-app tickets, case workspace (reply, note, priority, reassign, escalate, credit within the role limit, resolve, close, reopen), contacts, knowledge and templates, performance, team board (supervisors) |
| Agent portal administrator | `admin/` A31 | A01 | Admin role with `agentdesk.manage` (Super admin, Operations manager) | Agent accounts, roles and limits, channels and routing, templates and knowledge, announcements, publish and download the policy, live monitor and remote sign-out |

Customers, drivers and partners ask for help inside their own app (help centre, complaints, "Talk to an agent"); those
requests become conversations in the agent portal.

All sign-in, sessions and roles are **simulated in the browser** and are not security. Demo codes are public test
values. Reloading an application signs everyone out (state is in memory only).

## Admin mock roles

Super admin, Operations manager (default), Safety manager, Fraud analyst, Finance manager, Support agent, Fleet manager,
Auditor. Permissions follow architecture page 10; assumptions for actions it does not cover are listed in
[../workflows/rbac.md](../workflows/rbac.md) plus `ride.dispatch` (Super admin, Operations manager) added in this phase.
