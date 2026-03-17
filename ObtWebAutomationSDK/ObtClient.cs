using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using ObtWebAutomationSDK.Models;

namespace ObtWebAutomationSDK;

public class ObtClient : IDisposable
{
    private readonly HttpClient _http;
    private readonly bool _ownsHttp;
    private readonly string? _apiKey;
    private readonly JsonSerializerOptions _jsonOptions = new JsonSerializerOptions
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = false
    };

    public Uri BaseUri => _http.BaseAddress!;

    public ObtClient(string baseUrl = "http://127.0.0.1:5478", string? apiKey = null, HttpMessageHandler? handler = null)
    {
        _ownsHttp = true;
        _apiKey = apiKey;
        _http = handler is null ? new HttpClient() : new HttpClient(handler, disposeHandler: true);
        _http.BaseAddress = new Uri(AppendNoTrailingSlash(baseUrl));
        _http.DefaultRequestHeaders.Accept.Clear();
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        if (!string.IsNullOrEmpty(apiKey)) _http.DefaultRequestHeaders.Add("X-API-Key", apiKey);
    }

    public ObtClient(HttpClient httpClient, string? apiKey = null)
    {
        _http = httpClient ?? throw new ArgumentNullException(nameof(httpClient));
        _ownsHttp = false;
        _apiKey = apiKey;
        if (!string.IsNullOrEmpty(apiKey) && !_http.DefaultRequestHeaders.Contains("X-API-Key"))
        {
            _http.DefaultRequestHeaders.Add("X-API-Key", apiKey);
        }
    }

    private static string AppendNoTrailingSlash(string baseUrl)
        => baseUrl.EndsWith("/") ? baseUrl.TrimEnd('/') : baseUrl;

    private async Task<T> SendAsync<T>(HttpMethod method, string path, object? body = null, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(method, path);
        if (body != null)
        {
            var json = JsonSerializer.Serialize(body, _jsonOptions);
            req.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }
        using var resp = await _http.SendAsync(req, ct).ConfigureAwait(false);
        var content = await resp.Content.ReadAsStringAsync(ct).ConfigureAwait(false);
        if (!resp.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"HTTP {(int)resp.StatusCode} {resp.ReasonPhrase}: {content}");
        }
        if (typeof(T) == typeof(string))
        {
            return (T)(object)content;
        }
        return JsonSerializer.Deserialize<T>(content, _jsonOptions) ?? throw new InvalidOperationException("Failed to parse response JSON.");
    }

    // Health
    public Task<HealthResponse> HealthAsync(CancellationToken ct = default)
        => SendAsync<HealthResponse>(HttpMethod.Get, "/api/health", null, ct);

    // Profiles CRUD
    public Task<List<Profile>> GetProfilesAsync(CancellationToken ct = default)
        => SendAsync<List<Profile>>(HttpMethod.Get, "/api/profiles", null, ct);

    public Task<ProfileResult> CreateProfileAsync(Profile profile, CancellationToken ct = default)
        => SendAsync<ProfileResult>(HttpMethod.Post, "/api/profiles", profile, ct);

    public Task<ProfileResult> UpdateProfileAsync(string id, Profile profile, CancellationToken ct = default)
        => SendAsync<ProfileResult>(HttpMethod.Put, $"/api/profiles/{Uri.EscapeDataString(id)}", profile, ct);

    public Task<BasicResult> DeleteProfileAsync(string id, CancellationToken ct = default)
        => SendAsync<BasicResult>(HttpMethod.Delete, $"/api/profiles/{Uri.EscapeDataString(id)}", null, ct);

    // Launch / stop
    public Task<LaunchResult> LaunchProfileAsync(string id, LaunchOptions? options = null, CancellationToken ct = default)
        => SendAsync<LaunchResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/launch", options, ct);

    public Task<BasicResult> StopProfileAsync(string id, CancellationToken ct = default)
        => SendAsync<BasicResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/stop", null, ct);

    public Task<StopAllResult> StopAllAsync(CancellationToken ct = default)
        => SendAsync<StopAllResult>(HttpMethod.Post, "/api/stop-all", null, ct);

    // Running + WS
    public Task<RunningMapResult> GetRunningMapAsync(CancellationToken ct = default)
        => SendAsync<RunningMapResult>(HttpMethod.Get, "/api/running-map", null, ct);

    public Task<WsResult> GetProfileWsAsync(string id, CancellationToken ct = default)
        => SendAsync<WsResult>(HttpMethod.Get, $"/api/profiles/{Uri.EscapeDataString(id)}/ws", null, ct);

    // Cookies
    public Task<CookiesResult> GetCookiesAsync(string id, CancellationToken ct = default)
        => SendAsync<CookiesResult>(HttpMethod.Get, $"/api/profiles/{Uri.EscapeDataString(id)}/cookies", null, ct);

    public Task<BasicResult> ImportCookiesAsync(string id, IEnumerable<CookieItem> cookies, CancellationToken ct = default)
        => SendAsync<BasicResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/cookies", cookies, ct);

    // Log + clone
    public Task<LogResult> GetProfileLogAsync(string id, CancellationToken ct = default)
        => SendAsync<LogResult>(HttpMethod.Get, $"/api/profiles/{Uri.EscapeDataString(id)}/log", null, ct);

    public Task<ProfileResult> CloneProfileAsync(string id, object? options = null, CancellationToken ct = default)
        => SendAsync<ProfileResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/clone", options, ct);

    // Locales/timezones
    public Task<LocalesTimezonesResult> GetLocalesTimezonesAsync(CancellationToken ct = default)
        => SendAsync<LocalesTimezonesResult>(HttpMethod.Get, "/api/locales-timezones", null, ct);

    // Browser control
    public Task<PagesResponse> ListPagesAsync(string id, CancellationToken ct = default)
        => SendAsync<PagesResponse>(HttpMethod.Get, $"/api/profiles/{Uri.EscapeDataString(id)}/pages", null, ct);

    public Task<BasicResult> NavigateAsync(string id, NavigateRequest request, CancellationToken ct = default)
        => SendAsync<BasicResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/navigate", request, ct);

    public Task<BasicResult> NewPageAsync(string id, NewPageRequest? request = null, CancellationToken ct = default)
        => SendAsync<BasicResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/new-page", request, ct);

    public Task<BasicResult> ClosePageAsync(string id, ClosePageRequest? request = null, CancellationToken ct = default)
        => SendAsync<BasicResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/close-page", request, ct);

    public Task<ScreenshotResult> ScreenshotAsync(string id, ScreenshotRequest? request = null, CancellationToken ct = default)
        => SendAsync<ScreenshotResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/screenshot", request, ct);

    public Task<EvalResult> EvalAsync(string id, EvalRequest request, CancellationToken ct = default)
        => SendAsync<EvalResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/eval", request, ct);

    // Actions
    public Task<ActionsListResult> ListActionsAsync(CancellationToken ct = default)
        => SendAsync<ActionsListResult>(HttpMethod.Get, "/api/actions", null, ct);

    public Task<ActionResult> PerformActionAsync(string id, string name, object? parameters = null, CancellationToken ct = default)
        => SendAsync<ActionResult>(HttpMethod.Post, $"/api/profiles/{Uri.EscapeDataString(id)}/action/{Uri.EscapeDataString(name)}", parameters, ct);

    // Actions - typed helpers
    // Click
    public Task<ActionResult> ClickAtAsync(string id, ClickAtParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "click.at", p, ct);
    public Task<ActionResult> ClickPercentAsync(string id, ClickPercentParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "click.percent", p, ct);
    public Task<ActionResult> ClickElementAsync(string id, ClickElementParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "click.element", p, ct);

    // Scroll
    public Task<ActionResult> ScrollPercentAsync(string id, ScrollPercentParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "scroll.percent", p, ct);
    public Task<ActionResult> ScrollFromToAsync(string id, ScrollFromToParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "scroll.fromTo", p, ct);
    public Task<ActionResult> ScrollElementToElementAsync(string id, ScrollElementToElementParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "scroll.elementToElement", p, ct);

    // Keyboard
    public Task<ActionResult> KeyboardSendAsync(string id, KeyboardSendParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "keyboard.send", p, ct);

    // Capture
    public Task<ActionResult> CaptureScreenAsync(string id, CaptureScreenParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "capture.screen", p, ct);
    public Task<ActionResult> CaptureElementAsync(string id, CaptureElementParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "capture.element", p, ct);

    // Wait / hover
    public Task<ActionResult> WaitAsync(string id, WaitParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "wait", p, ct);
    public Task<ActionResult> HoverAsync(string id, HoverParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "hover", p, ct);

    // Drag and drop
    public Task<ActionResult> DragAndDropAsync(string id, DragAndDropParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "dragAndDrop", p, ct);

    // Inputs
    public Task<ActionResult> InputFillAsync(string id, InputFillParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "input.fill", p, ct);
    public Task<ActionResult> SelectOptionAsync(string id, SelectOptionParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "select.option", p, ct);
    public Task<ActionResult> ElementFocusAsync(string id, ElementFocusParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "element.focus", p, ct);
    public Task<ActionResult> InputTypeAsync(string id, InputTypeParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "input.type", p, ct);
    public Task<ActionResult> InputClearAsync(string id, InputClearParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "input.clear", p, ct);
    public Task<ActionResult> InputCheckAsync(string id, InputCheckParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "input.check", p, ct);
    public Task<ActionResult> InputUncheckAsync(string id, InputUncheckParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "input.uncheck", p, ct);
    public Task<ActionResult> InputSetFilesAsync(string id, InputSetFilesParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "input.setFiles", p, ct);

    // Navigation
    public Task<ActionResult> NavGotoAsync(string id, NavGotoParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "nav.goto", p, ct);
    public Task<ActionResult> NavBackAsync(string id, NavBackParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "nav.back", p, ct);
    public Task<ActionResult> NavForwardAsync(string id, NavForwardParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "nav.forward", p, ct);
    public Task<ActionResult> NavReloadAsync(string id, NavReloadParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "nav.reload", p, ct);
    public Task<ActionResult> WaitLoadStateAsync(string id, WaitLoadStateParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "wait.loadState", p, ct);

    // Storage - local
    public Task<ActionResult> StorageLocalSetAsync(string id, StorageLocalSetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.local.set", p, ct);
    public Task<ActionResult> StorageLocalGetAsync(string id, StorageLocalGetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.local.get", p, ct);
    public Task<ActionResult> StorageLocalRemoveAsync(string id, StorageLocalRemoveParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.local.remove", p, ct);
    public Task<ActionResult> StorageLocalClearAsync(string id, StorageLocalClearParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.local.clear", p, ct);

    // Storage - session
    public Task<ActionResult> StorageSessionSetAsync(string id, StorageSessionSetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.session.set", p, ct);
    public Task<ActionResult> StorageSessionGetAsync(string id, StorageSessionGetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.session.get", p, ct);
    public Task<ActionResult> StorageSessionRemoveAsync(string id, StorageSessionRemoveParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.session.remove", p, ct);
    public Task<ActionResult> StorageSessionClearAsync(string id, StorageSessionClearParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "storage.session.clear", p, ct);

    // Cookies
    public Task<ActionResult> CookiesGetAsync(string id, CookiesGetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "cookies.get", p, ct);
    public Task<ActionResult> CookiesSetAsync(string id, CookiesSetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "cookies.set", p, ct);
    public Task<ActionResult> CookiesClearAsync(string id, CookiesClearParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "cookies.clear", p, ct);

    // Network/env
    public Task<ActionResult> NetworkSetOfflineAsync(string id, NetworkSetOfflineParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "network.setOffline", p, ct);
    public Task<ActionResult> GeolocationSetAsync(string id, GeolocationSetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "geolocation.set", p, ct);
    public Task<ActionResult> ViewportSetAsync(string id, ViewportSetParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "viewport.set", p, ct);
    public Task<ActionResult> HeadersSetExtraAsync(string id, HeadersSetExtraParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "headers.setExtra", p, ct);

    // Tabs / page
    public Task<ActionResult> TabNewAsync(string id, TabNewParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "tab.new", p, ct);
    public Task<ActionResult> TabCloseAsync(string id, TabCloseParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "tab.close", p, ct);
    public Task<ActionResult> PageFrontAsync(string id, PageFrontParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.front", p, ct);

    // Eval
    public Task<ActionResult> JsEvalActionAsync(string id, JsEvalParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "js.eval", p, ct);
    public Task<ActionResult> ElementEvalActionAsync(string id, ElementEvalParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "element.eval", p, ct);

    // Info helpers
    public Task<ActionResult> PageContentAsync(string id, PageContentParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.content", p, ct);
    public Task<ActionResult> PageTitleAsync(string id, PageTitleParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.title", p, ct);
    public Task<ActionResult> PageUrlAsync(string id, PageUrlParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.url", p, ct);
    public Task<ActionResult> ElementTextAsync(string id, ElementTextParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "element.text", p, ct);
    public Task<ActionResult> ElementHtmlAsync(string id, ElementHtmlParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "element.html", p, ct);
    public Task<ActionResult> ElementAttrAsync(string id, ElementAttrParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "element.attr", p, ct);

    // Script/style/pdf
    public Task<ActionResult> PageScriptAddAsync(string id, PageScriptAddParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.script.add", p, ct);
    public Task<ActionResult> PageStyleAddAsync(string id, PageStyleAddParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.style.add", p, ct);
    public Task<ActionResult> PagePdfAsync(string id, PagePdfParams p, CancellationToken ct = default)
        => PerformActionAsync(id, "page.pdf", p, ct);

    public void Dispose()
    {
        if (_ownsHttp)
        {
            _http.Dispose();
        }
    }
}
