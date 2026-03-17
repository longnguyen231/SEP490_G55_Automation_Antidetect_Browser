using System;
using System.Collections.Generic;
using System.Text.Json.Serialization;

namespace ObtWebAutomationSDK.Models;

public class Profile
{
    public string? Id { get; set; }
    public string? Name { get; set; }
    public string? Description { get; set; }
    public string? StartUrl { get; set; }

    // Loose typing for fingerprint/settings to stay forward-compatible
    public Dictionary<string, object?>? Fingerprint { get; set; }
    public Dictionary<string, object?>? Settings { get; set; }

    public DateTimeOffset? CreatedAt { get; set; }
}

public class LaunchOptions
{
    public bool? Headless { get; set; }
    public string? Engine { get; set; } // playwright | cdp
    public string? CdpHost { get; set; }
    public int? CdpPort { get; set; }
}

public class CookieItem
{
    public string? Name { get; set; }
    public string? Value { get; set; }
    public string? Domain { get; set; }
    public string? Path { get; set; }
    public long? Expires { get; set; }
    public bool? HttpOnly { get; set; }
    public bool? Secure { get; set; }
    public string? SameSite { get; set; }

    [JsonExtensionData]
    public Dictionary<string, object?>? Extra { get; set; }
}
