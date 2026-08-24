// Every URL here is relative on purpose: ingress serves the app from a path
// prefix that the add-on never sees. A leading slash would leave the add-on.
const result = document.getElementById("result");

document.getElementById("ping").addEventListener("click", async () => {
  result.textContent = "…";
  try {
    const response = await fetch("api/ping");
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      result.textContent = `Not JSON (${response.status} ${contentType}) — ` +
        "the request escaped the add-on, check for absolute URLs.";
      return;
    }
    const data = await response.json();
    result.textContent = `${response.status} ${JSON.stringify(data)} from ${response.url}`;
  } catch (error) {
    result.textContent = `Failed: ${error}`;
  }
});
