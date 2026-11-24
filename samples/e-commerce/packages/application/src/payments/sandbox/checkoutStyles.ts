export const checkoutStyles = `:root {
  --accent: #635bff;
  --text: #1a1f36;
  --muted: #697386;
  --border: #e3e8ee;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  color: var(--text);
  background: #fff;
}

.checkout { display: grid; grid-template-columns: 1fr 1fr; min-height: 100vh; }

.summary { background: #f7f7f9; padding: 64px 56px; border-right: 1px solid var(--border); }
.back { color: var(--muted); text-decoration: none; font-size: 14px; }
.merchant { font-weight: 600; margin: 32px 0 24px; }
.sandbox { background: #fcedb9; color: #a04100; font-size: 12px; font-weight: 600; padding: 2px 8px; border-radius: 4px; margin-left: 8px; }
.label { color: var(--muted); margin: 0; }
.amount { font-size: 36px; font-weight: 600; margin: 4px 0; }

.payment { padding: 64px 56px; max-width: 520px; }
.payment h1 { font-size: 20px; margin: 0 0 24px; }

label { display: block; font-size: 13px; color: var(--muted); margin: 16px 0 6px; }

input {
  width: 100%;
  font: inherit;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 6px;
}
input:focus { outline: 2px solid rgba(99, 91, 255, 0.35); border-color: var(--accent); }

.card-fields input:first-child { border-radius: 6px 6px 0 0; }
.card-fields .row { display: grid; grid-template-columns: 1fr 1fr; }
.card-fields .row input { border-top: 0; border-radius: 0; }
.card-fields .row input:first-child { border-radius: 0 0 0 6px; }
.card-fields .row input:last-child { border-left: 0; border-radius: 0 0 6px 0; }

.pay {
  width: 100%;
  margin-top: 24px;
  padding: 14px;
  font: inherit;
  font-weight: 600;
  color: #fff;
  background: var(--accent);
  border: 0;
  border-radius: 6px;
  cursor: pointer;
}

.error { color: #df1b41; font-size: 14px; margin: 12px 0 0; }
.hint { color: var(--muted); font-size: 13px; margin-top: 16px; }

.button { display: inline-block; padding: 10px 18px; border: 1px solid var(--border); border-radius: 6px; color: var(--text); text-decoration: none; }

@media (max-width: 760px) {
  .checkout { grid-template-columns: 1fr; }
  .summary, .payment { padding: 32px 24px; }
}
`;
