using System.Text.Json.Serialization;

namespace ObtWebAutomationSDK.Models;

public class NavigateRequest
{
    public string Url { get; set; } = string.Empty;
    public bool? NewPage { get; set; }
    public string? WaitUntil { get; set; } // load | domcontentloaded | networkidle
}

public class NewPageRequest
{
    public string? Url { get; set; }
    public string? WaitUntil { get; set; }
}

public class ClosePageRequest
{
    public int? Index { get; set; }
}

public class ScreenshotRequest
{
    public int? Index { get; set; }
    public string? Path { get; set; }
    public bool? FullPage { get; set; }
}

public class EvalRequest
{
    public int? Index { get; set; }
    public string Expression { get; set; } = string.Empty;
}
