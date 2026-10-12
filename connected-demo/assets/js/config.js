/* Connected demo (local only, not deployed): opens the application folders of this repository side by side.
   Serve the repository root with one web server to use it. */
window.RN_CONFIG = {
  brand: "RideNova",
  apps: {
    rider: "../customer-app/index.html",
    driver: "../driver-app/index.html",
    partner: "../patner-app/index.html",
    admin: "../admin/index.html",
    support: "../agent-portal/index.html"
  }
};
