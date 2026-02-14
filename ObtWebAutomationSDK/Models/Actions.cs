using System.Collections.Generic;

namespace ObtWebAutomationSDK.Models;

// Click
public class ClickAtParams { public int X { get; set; } public int Y { get; set; } public string? Button { get; set; } public int? ClickCount { get; set; } public int? Delay { get; set; } }
public class ClickPercentParams { public double XPercent { get; set; } public double YPercent { get; set; } public string? Selector { get; set; } public string? Button { get; set; } public int? ClickCount { get; set; } public int? Delay { get; set; } public int? Timeout { get; set; } }
public class ClickElementParams { public string Selector { get; set; } = string.Empty; public string? Button { get; set; } public int? ClickCount { get; set; } public int? Timeout { get; set; } public ElementPosition? Position { get; set; } }
public class ElementPosition { public int X { get; set; } public int Y { get; set; } }

// Scroll
public class ScrollPercentParams { public double XPercent { get; set; } public double YPercent { get; set; } public string? Selector { get; set; } }
public class ScrollFromToParams { public int X1 { get; set; } public int Y1 { get; set; } public int X2 { get; set; } public int Y2 { get; set; } public int? Steps { get; set; } }
public class ScrollElementToElementParams { public string FromSelector { get; set; } = string.Empty; public string ToSelector { get; set; } = string.Empty; public string? Behavior { get; set; } public string? Block { get; set; } public string? Inline { get; set; } public int? Timeout { get; set; } }

// Keyboard
public class KeyboardSendParams { public string? Text { get; set; } public string? Press { get; set; } public string[]? Sequence { get; set; } public int? Delay { get; set; } }

// Capture
public class CaptureScreenParams { public int? Index { get; set; } public string? Path { get; set; } public bool? FullPage { get; set; } }
public class CaptureElementParams { public string Selector { get; set; } = string.Empty; public string? Path { get; set; } public int? Timeout { get; set; } }

// Wait
public class WaitParams { public int? Ms { get; set; } public string? Selector { get; set; } public string? State { get; set; } public int? Timeout { get; set; } }

// Hover
public class HoverParams { public string Selector { get; set; } = string.Empty; public int? Timeout { get; set; } }

// Drag and drop
public class DragAndDropParams { public string From { get; set; } = string.Empty; public string To { get; set; } = string.Empty; public int? Steps { get; set; } public int? Timeout { get; set; } }

// Inputs
public class InputFillParams { public string Selector { get; set; } = string.Empty; public string Value { get; set; } = string.Empty; public int? Timeout { get; set; } }
public class SelectOptionParams { public string Selector { get; set; } = string.Empty; public string[] Values { get; set; } = System.Array.Empty<string>(); public int? Timeout { get; set; } }
public class ElementFocusParams { public string Selector { get; set; } = string.Empty; public int? Timeout { get; set; } }
public class InputTypeParams { public string Selector { get; set; } = string.Empty; public string Text { get; set; } = string.Empty; public int? Delay { get; set; } public int? Timeout { get; set; } }
public class InputClearParams { public string Selector { get; set; } = string.Empty; public int? Timeout { get; set; } }
public class InputCheckParams { public string Selector { get; set; } = string.Empty; public int? Timeout { get; set; } }
public class InputUncheckParams { public string Selector { get; set; } = string.Empty; public int? Timeout { get; set; } }
public class InputSetFilesParams { public string Selector { get; set; } = string.Empty; public string[] Files { get; set; } = System.Array.Empty<string>(); public int? Timeout { get; set; } }

// Navigation
public class NavGotoParams { public string Url { get; set; } = string.Empty; public string? WaitUntil { get; set; } public bool? NewPage { get; set; } public int? Index { get; set; } }
public class NavBackParams { public string? WaitUntil { get; set; } public int? Index { get; set; } }
public class NavForwardParams { public string? WaitUntil { get; set; } public int? Index { get; set; } }
public class NavReloadParams { public string? WaitUntil { get; set; } public int? Index { get; set; } }
public class WaitLoadStateParams { public string? State { get; set; } public int? Index { get; set; } public int? Timeout { get; set; } }

// Storage
public class StorageLocalSetParams { public Dictionary<string, object?> Items { get; set; } = new(); }
public class StorageLocalGetParams { public string[]? Keys { get; set; } }
public class StorageLocalRemoveParams { public string[] Keys { get; set; } = System.Array.Empty<string>(); }
public class StorageLocalClearParams { }

public class StorageSessionSetParams { public Dictionary<string, object?> Items { get; set; } = new(); }
public class StorageSessionGetParams { public string[]? Keys { get; set; } }
public class StorageSessionRemoveParams { public string[] Keys { get; set; } = System.Array.Empty<string>(); }
public class StorageSessionClearParams { }

// Cookies
public class CookiesGetParams { public string[]? Urls { get; set; } }
public class CookiesSetParams { public List<CookieItem> Cookies { get; set; } = new(); }
public class CookiesClearParams { }

// Network / env
public class NetworkSetOfflineParams { public bool? Offline { get; set; } }
public class GeolocationSetParams { public double Latitude { get; set; } public double Longitude { get; set; } public double? Accuracy { get; set; } }
public class ViewportSetParams { public int Width { get; set; } public int Height { get; set; } public double? DeviceScaleFactor { get; set; } }
public class HeadersSetExtraParams { public Dictionary<string, string> Headers { get; set; } = new(); }

// Tabs / page
public class TabNewParams { public string? Url { get; set; } public string? WaitUntil { get; set; } }
public class TabCloseParams { public int? Index { get; set; } }
public class PageFrontParams { public int? Index { get; set; } }

// JS eval
public class JsEvalParams { public string Expression { get; set; } = string.Empty; public object? Arg { get; set; } public int? Index { get; set; } }
public class ElementEvalParams { public string Selector { get; set; } = string.Empty; public string Expression { get; set; } = string.Empty; public int? Index { get; set; } public int? Timeout { get; set; } }

// Page info helpers
public class PageContentParams { public int? Index { get; set; } }
public class PageTitleParams { public int? Index { get; set; } }
public class PageUrlParams { public int? Index { get; set; } }
public class ElementTextParams { public string Selector { get; set; } = string.Empty; public int? Index { get; set; } public int? Timeout { get; set; } }
public class ElementHtmlParams { public string Selector { get; set; } = string.Empty; public int? Index { get; set; } public int? Timeout { get; set; } }
public class ElementAttrParams { public string Selector { get; set; } = string.Empty; public string Name { get; set; } = string.Empty; public int? Index { get; set; } public int? Timeout { get; set; } }

// Script/style/pdf
public class PageScriptAddParams { public string? Url { get; set; } public string? Path { get; set; } public string? Content { get; set; } public string? Type { get; set; } }
public class PageStyleAddParams { public string? Url { get; set; } public string? Path { get; set; } public string? Content { get; set; } }
public class PagePdfParams { public string Path { get; set; } = string.Empty; public string? Format { get; set; } public bool? PrintBackground { get; set; } public bool? Landscape { get; set; } public double? Scale { get; set; } public PdfMargin? Margin { get; set; } }
public class PdfMargin { public double? Top { get; set; } public double? Right { get; set; } public double? Bottom { get; set; } public double? Left { get; set; } }
