// Validation Utilities

/**
 * Validate profile name
 */
export function validateProfileName(name) {
  if (!name || typeof name !== 'string') {
    return { valid: false, error: 'Profile name is required' };
  }
  
  if (name.trim().length === 0) {
    return { valid: false, error: 'Profile name cannot be empty' };
  }
  
  if (name.length > 100) {
    return { valid: false, error: 'Profile name must be less than 100 characters' };
  }
  
  return { valid: true };
}

/**
 * Validate URL
 */
export function validateUrl(url) {
  if (!url || typeof url !== 'string') {
    return { valid: false, error: 'URL is required' };
  }
  
  try {
    new URL(url);
    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Validate email
 */
export function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return { valid: false, error: 'Email is required' };
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  
  return { valid: true };
}

/**
 * Validate proxy format (host:port:username:password or host:port)
 */
export function validateProxy(proxy) {
  if (!proxy || typeof proxy !== 'string') {
    return { valid: false, error: 'Proxy is required' };
  }
  
  const parts = proxy.split(':');
  if (parts.length < 2) {
    return { valid: false, error: 'Proxy format: host:port or host:port:user:pass' };
  }
  
  const [host, port] = parts;
  if (!host || !port) {
    return { valid: false, error: 'Host and port are required' };
  }
  
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }
  
  return { valid: true };
}

/**
 * Validate User Agent
 */
export function validateUserAgent(userAgent) {
  if (!userAgent || typeof userAgent !== 'string') {
    return { valid: false, error: 'User agent is required' };
  }
  
  if (userAgent.length < 10) {
    return { valid: false, error: 'User agent is too short' };
  }
  
  return { valid: true };
}

/**
 * Validate port number
 */
export function validatePort(port) {
  const portNum = parseInt(port);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return { valid: false, error: 'Port must be between 1 and 65535' };
  }
  return { valid: true };
}

/**
 * Validate profile object
 */
export function validateProfile(profile) {
  const errors = {};
  
  const nameValidation = validateProfileName(profile.name);
  if (!nameValidation.valid) {
    errors.name = nameValidation.error;
  }
  
  if (profile.startUrl) {
    const urlValidation = validateUrl(profile.startUrl);
    if (!urlValidation.valid) {
      errors.startUrl = urlValidation.error;
    }
  }
  
  if (profile.fingerprint?.userAgent) {
    const uaValidation = validateUserAgent(profile.fingerprint.userAgent);
    if (!uaValidation.valid) {
      errors.userAgent = uaValidation.error;
    }
  }
  
  if (profile.settings?.proxy) {
    const proxyValidation = validateProxy(profile.settings.proxy);
    if (!proxyValidation.valid) {
      errors.proxy = proxyValidation.error;
    }
  }
  
  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}
