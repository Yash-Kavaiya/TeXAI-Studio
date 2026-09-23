export class MissingApiKeyError extends Error {
  constructor(which: 'anthropic' | 'mem0') {
    super(`No ${which} API key configured`)
    this.name = 'MissingApiKeyError'
  }
}

export class ClaudeRefusalError extends Error {
  constructor(details: unknown) {
    super('Claude declined this request')
    this.name = 'ClaudeRefusalError'
    this.cause = details
  }
}

export class MalformedOutputError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MalformedOutputError'
  }
}
