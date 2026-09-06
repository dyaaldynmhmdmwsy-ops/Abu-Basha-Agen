"use strict";

module.exports = [
  {
    name: "gemini",
    provider: "Google",
    category: "ai",
    description: "Google Gemini / Google AI Studio",
    envKey: "GEMINI_API_KEY"
  },
  {
    name: "openai",
    provider: "OpenAI",
    category: "ai",
    description: "OpenAI API",
    envKey: "OPENAI_API_KEY"
  },
  {
    name: "anthropic",
    provider: "Anthropic",
    category: "ai",
    description: "Anthropic API",
    envKey: "ANTHROPIC_API_KEY"
  },
  {
    name: "groq",
    provider: "Groq",
    category: "ai",
    description: "Groq API",
    envKey: "GROQ_API_KEY"
  },
  {
    name: "openrouter",
    provider: "OpenRouter",
    category: "ai",
    description: "OpenRouter API",
    envKey: "OPENROUTER_API_KEY"
  },
  {
    name: "huggingface",
    provider: "Hugging Face",
    category: "ai",
    description: "Hugging Face API",
    envKey: "HF_TOKEN"
  },
  {
    name: "github",
    provider: "GitHub",
    category: "developer",
    description: "GitHub repositories, issues and code",
    envKey: "GITHUB_TOKEN"
  },
  {
    name: "gitlab",
    provider: "GitLab",
    category: "developer",
    description: "GitLab repositories and CI/CD",
    envKey: "GITLAB_TOKEN"
  },
  {
    name: "bitbucket",
    provider: "Bitbucket",
    category: "developer",
    description: "Bitbucket repositories",
    envKey: "BITBUCKET_TOKEN"
  },
  {
    name: "termux",
    provider: "Termux",
    category: "developer",
    description: "Local Termux development environment",
    envKey: null
  },
  {
    name: "node",
    provider: "Node.js",
    category: "developer",
    description: "Node.js runtime",
    envKey: null
  },
  {
    name: "python",
    provider: "Python",
    category: "developer",
    description: "Python runtime",
    envKey: null
  }
];
