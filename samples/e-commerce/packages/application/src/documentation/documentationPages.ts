const reactComponentVersion = '3.2.3';
const cdn = `https://unpkg.com/@asyncapi/react-component@${reactComponentVersion}`;

const inScript = (value: unknown) =>
  JSON.stringify(value).replaceAll('<', '\\u003c');

export const asyncApiPage = () => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>E-commerce AsyncAPI</title>
    <link rel="stylesheet" href="${cdn}/styles/default.min.css" />
  </head>
  <body>
    <p><a href="/asyncapi/publish">Publish a message</a> | <a href="/asyncapi.json">asyncapi.json</a></p>
    <div id="asyncapi"></div>
    <script src="${cdn}/browser/standalone/index.js"></script>
    <script>
      AsyncApiStandalone.render(
        { schema: { url: '/asyncapi.json', options: { method: 'GET', mode: 'cors' } } },
        document.getElementById('asyncapi'),
      );
    </script>
  </body>
</html>`;

export type PublishableMessage = {
  type: string;
  channel: string | undefined;
  example: unknown;
};

export const publishPage = (messages: PublishableMessage[]) => `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Publish a message</title>
  </head>
  <body>
    <h1>Publish a message</h1>
    <p>Sends the message to its channel, as an outside system would. <a href="/asyncapi">Back to AsyncAPI</a></p>
    <form id="publish">
      <select id="type" name="type">
        ${messages.map(({ type, channel }) => `<option value="${type}">${type} (${channel})</option>`).join('\n        ')}
      </select>
      <textarea id="data" name="data" rows="14" cols="80"></textarea>
      <button type="submit">Publish</button>
    </form>
    <pre id="result"></pre>
    <script>
      const messages = ${inScript(messages)};
      const type = document.getElementById('type');
      const data = document.getElementById('data');
      const show = () => {
        data.value = JSON.stringify(messages.find((m) => m.type === type.value).example, null, 2);
      };
      type.addEventListener('change', show);
      show();
      document.getElementById('publish').addEventListener('submit', async (event) => {
        event.preventDefault();
        const response = await fetch('/asyncapi/publish', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ type: type.value, data: JSON.parse(data.value) }),
        });
        document.getElementById('result').textContent =
          response.status === 202 ? 'Published' : await response.text();
      });
    </script>
  </body>
</html>`;
