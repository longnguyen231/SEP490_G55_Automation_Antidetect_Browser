# ObtWebAutomationSDK

C# SDK for interacting with the OBT Antidetect Browser REST API exposed by this repository.

## Quick start

- Default API base URL: `http://127.0.0.1:5478`
- Optional API key header: `X-API-Key` (only if configured in app settings)
- The REST server requires a password when starting from the app. Once running, the SDK can call endpoints directly.

### Install

Reference the project `ObtWebAutomationSDK` from your solution, or pack it as a NuGet and install.

### Usage

```csharp
using ObtWebAutomationSDK;
using ObtWebAutomationSDK.Models;

var client = new ObtClient(baseUrl: "http://127.0.0.1:5478", apiKey: null);

// Health
var health = await client.HealthAsync();
Console.WriteLine($"Health ok: {health.Ok}");

// List / create a profile
var profiles = await client.GetProfilesAsync();
var create = await client.CreateProfileAsync(new Profile
{
    Name = "Profile 1",
    StartUrl = "https://example.com",
});

if (create.Success)
{
    var id = create.Profile!.Id!;
    // Launch
    var launch = await client.LaunchProfileAsync(id, new LaunchOptions { Headless = false, Engine = "playwright" });
    Console.WriteLine($"Launched: {launch.Success}, WS: {launch.WsEndpoint}");

    // Navigate
    await client.NavigateAsync(id, new NavigateRequest { Url = "https://example.com" });

    // Screenshot (inline base64)
    var shot = await client.ScreenshotAsync(id, new ScreenshotRequest { FullPage = true });
    if (!string.IsNullOrEmpty(shot.Base64))
    {
        File.WriteAllBytes("shot.png", Convert.FromBase64String(shot.Base64));
    }

    // Stop
    await client.StopProfileAsync(id);
}
```

## Endpoints covered

- Health
- Profiles CRUD
- Launch/Stop/StopAll, Running map, WS endpoint
- Cookies (get/import)
- Logs, Clone
- Locales/Timezones
- Browser control (pages, navigate, new/close page, screenshot, eval)
- Actions (list, perform)

## Notes

- JSON serialization uses System.Text.Json with camelCase names.
- For future fields, response DTOs include extension data where applicable.
- On HTTP errors (non-2xx), methods throw HttpRequestException containing response content.