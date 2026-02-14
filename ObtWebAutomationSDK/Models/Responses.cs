using System;
using System.Collections.Generic;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ObtWebAutomationSDK.Models;

public class HealthResponse { public bool Ok { get; set; } }

public class BasicResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    [JsonExtensionData] public Dictionary<string, JsonElement>? Extra { get; set; }
}

public class ProfileResult : BasicResult
{
    public Profile? Profile { get; set; }
}

public class LaunchResult : BasicResult
{
    public string? WsEndpoint { get; set; }
}

public class StopAllResult : BasicResult
{
    public int? Stopped { get; set; }
}

public class RunningMapResult
{
    public bool Success { get; set; }
    public Dictionary<string, string?>? Map { get; set; }
    [JsonExtensionData] public Dictionary<string, JsonElement>? Extra { get; set; }
}

public class WsResult : BasicResult
{
    public string? WsEndpoint { get; set; }
}

public class CookiesResult : BasicResult
{
    public List<CookieItem>? Cookies { get; set; }
}

public class LogResult : BasicResult
{
    public string? Log { get; set; }
}

public class LocalesTimezonesResult : BasicResult
{
    public List<string>? Locales { get; set; }
    public List<string>? Timezones { get; set; }
}

public class PagesResponse
{
    public bool Success { get; set; }
    public List<PageInfo>? Pages { get; set; }
}

public class PageInfo
{
    public int Index { get; set; }
    public string? Url { get; set; }
    public string? Title { get; set; }
}

public class ScreenshotResult : BasicResult
{
    public string? Base64 { get; set; }
    public string? Path { get; set; }
}

public class EvalResult : BasicResult
{
    public JsonElement? Value { get; set; }
}

public class ActionsListResult : BasicResult
{
    public List<string>? Actions { get; set; }
}

public class ActionResult : BasicResult { }
