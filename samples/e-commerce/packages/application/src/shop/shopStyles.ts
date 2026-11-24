export const shopStyles = `:root {
  --accent: #635bff;
  --accent-dark: #4b45c6;
  --text: #1a1f36;
  --muted: #697386;
  --border: #e3e8ee;
  --background: #f6f9fc;
  --card: #ffffff;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text);
  background: var(--background);
  line-height: 1.5;
}

a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 32px;
  background: var(--card);
  border-bottom: 1px solid var(--border);
}

.brand { font-weight: 700; font-size: 18px; color: var(--text); }
.topbar nav a { margin-left: 24px; color: var(--muted); font-weight: 500; }
.topbar nav a.active { color: var(--text); }
.topbar nav { display: flex; align-items: center; }
.topbar .customer { margin-left: 32px; padding-left: 24px; border-left: 1px solid var(--border); font-weight: 600; }
.topbar .logout { margin-left: 16px; }
.topbar .menu { position: relative; margin-left: 24px; }
.topbar .menu summary { list-style: none; color: var(--muted); font-weight: 500; cursor: pointer; }
.topbar .menu summary::-webkit-details-marker { display: none; }
.topbar .menu summary::after { content: " ▾"; font-size: 12px; }
.topbar .menu[open] summary { color: var(--text); }
.topbar .menu-items {
  position: absolute;
  right: 0;
  top: calc(100% + 12px);
  z-index: 10;
  display: flex;
  flex-direction: column;
  min-width: 260px;
  padding: 6px 0;
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(26, 31, 54, 0.12);
}
.topbar .menu-items a { margin: 0; padding: 8px 16px; color: var(--text); white-space: nowrap; }
.topbar .menu-items a:hover { background: var(--background); text-decoration: none; }

.page.login { max-width: 440px; }
.login label { display: block; font-weight: 600; margin-bottom: 8px; }
.login input { width: 100%; padding: 10px 12px; font: inherit; border: 1px solid var(--border); border-radius: 6px; }
.login .muted { margin-top: 8px; font-size: 14px; }

.page { max-width: 1040px; margin: 32px auto; padding: 0 24px; }
.page.narrow { max-width: 760px; }
.page-title { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 24px; }

h1 { font-size: 28px; margin: 0 0 24px; }
.page-title h1 { margin: 0; }
.page-title .muted { margin-top: 4px; font-size: 14px; }
h2 { font-size: 18px; margin: 0 0 8px; }

.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 20px; }

.card {
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 5px rgba(60, 66, 87, 0.06);
}

.product { display: flex; flex-direction: column; }
.product .price { font-size: 20px; font-weight: 600; margin: 8px 0 16px; }
.product form { margin-top: auto; }
.muted { color: var(--muted); margin: 0; }

.button {
  display: inline-block;
  border: 1px solid var(--border);
  background: var(--card);
  color: var(--text);
  font: inherit;
  font-weight: 600;
  padding: 10px 18px;
  border-radius: 8px;
  cursor: pointer;
}
.button:hover { text-decoration: none; background: var(--background); }
.button.primary { background: var(--accent); border-color: var(--accent); color: #fff; }
.button.primary:hover { background: var(--accent-dark); }
.button.wide { width: 100%; margin-top: 16px; }
.link { border: 0; background: none; color: var(--accent); font: inherit; cursor: pointer; padding: 0; }

.lines { width: 100%; border-collapse: collapse; }
.lines th { text-align: left; color: var(--muted); font-weight: 500; font-size: 13px; padding: 8px 0; border-bottom: 1px solid var(--border); }
.lines td { padding: 12px 0; border-bottom: 1px solid var(--border); }
.number, .lines th.number { text-align: right; }

.summary { display: flex; justify-content: space-between; font-size: 18px; padding-top: 16px; }

.empty { text-align: center; }
.notice { background: #fff8e6; border: 1px solid #f5d38a; border-radius: 8px; padding: 12px 16px; }

.actions { display: flex; gap: 12px; }

.badge { display: inline-block; white-space: nowrap; padding: 2px 10px; border-radius: 999px; font-size: 13px; font-weight: 600; background: #e3e8ee; color: var(--text); }
.badge.large { font-size: 15px; padding: 4px 14px; }
.badge.AwaitingPayment { background: #fcedb9; color: #a04100; }
.badge.PaymentFailed, .badge.OutOfStock { background: #ffe7f2; color: #b3093c; }
.badge.Processing { background: #e6ebff; color: var(--accent-dark); }
.badge.Shipped { background: #cbf4c9; color: #0e6245; }
.badge.Completed { background: #cbf4c9; color: #0e6245; }
.badge.Canceled, .badge.ClosedUnpaid { background: #e3e8ee; color: var(--muted); }

code { background: var(--background); padding: 2px 6px; border-radius: 4px; }

.nowrap { white-space: nowrap; }
.badge.sandbox { margin-left: 8px; background: #fcedb9; color: #a04100; font-size: 12px; vertical-align: middle; }
.actions { white-space: nowrap; }
.actions form { display: inline-block; margin-left: 8px; }
.card.notice { border-color: #ffc7dc; background: #fff5f9; }
`;
