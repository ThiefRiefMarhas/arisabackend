---
title: Image Inputs
subtitle: How to send images to OpenRouter models
headline: OpenRouter Image Inputs | Complete Documentation
canonical-url: 'https://openrouter.ai/docs/guides/overview/multimodal/images'
'og:site_name': OpenRouter Documentation
'og:title': OpenRouter Image Inputs - Complete Documentation
'og:description': Send images to vision models through the OpenRouter API.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?title=OpenRouter%20Image%20Inputs&description=Send%20images%20to%20vision%20models%20through%20the%20OpenRouter%20API.
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouter'
noindex: false
nofollow: false
---

  API_KEY_REF,
} from '../../../../imports/constants';

Requests with images, to multimodel models, are available via the `/api/v1/chat/completions` API with a multi-part `messages` parameter. The `image_url` can either be a URL or a base64-encoded image. Note that multiple images can be sent in separate content array entries. The number of images you can send in a single request varies per provider and per model. Due to how the content is parsed, we recommend sending the text prompt first, then the images. If the images must come first, we recommend putting it in the system prompt.

OpenRouter supports both **direct URLs** and **base64-encoded data** for images:

- **URLs**: More efficient for publicly accessible images as they don't require local encoding
- **Base64**: Required for local files or private images that aren't publicly accessible

### Using Image URLs

Here's how to send an image using a URL:

<Template data={{
  API_KEY_REF,
  MODEL: 'google/gemini-3-flash-preview'
}}>
<CodeGroup>

```typescript title="TypeScript SDK"

const openRouter = new OpenRouter({
  apiKey: '{{API_KEY_REF}}',
});

const result = await openRouter.chat.send({
  model: '{{MODEL}}',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: "What's in this image?",
        },
        {
          type: 'image_url',
          imageUrl: {
            url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg',
          },
        },
      ],
    },
  ],
  stream: false,
});

console.log(result);
```

```python

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What's in this image?"
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg"
                }
            }
        ]
    }
]

payload = {
    "model": "{{MODEL}}",
    "messages": messages
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

```typescript title="TypeScript (fetch)"
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: "What's in this image?",
          },
          {
            type: 'image_url',
            image_url: {
              url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg',
            },
          },
        ],
      },
    ],
  }),
});

const data = await response.json();
console.log(data);
```

</CodeGroup>
</Template>

### Using Base64 Encoded Images

For locally stored images, you can send them using base64 encoding. Here's how to do it:

<Template data={{
  API_KEY_REF,
  MODEL: 'google/gemini-3-flash-preview'
}}>
<CodeGroup>

```typescript title="TypeScript SDK"

const openRouter = new OpenRouter({
  apiKey: '{{API_KEY_REF}}',
});

async function encodeImageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  return `data:image/jpeg;base64,${base64Image}`;
}

// Read and encode the image
const imagePath = 'path/to/your/image.jpg';
const base64Image = await encodeImageToBase64(imagePath);

const result = await openRouter.chat.send({
  model: '{{MODEL}}',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: "What's in this image?",
        },
        {
          type: 'image_url',
          imageUrl: {
            url: base64Image,
          },
        },
      ],
    },
  ],
  stream: false,
});

console.log(result);
```

```python

from pathlib import Path

def encode_image_to_base64(image_path):
    with open(image_path, "rb") as image_file:
        return base64.b64encode(image_file.read()).decode('utf-8')

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

# Read and encode the image
image_path = "path/to/your/image.jpg"
base64_image = encode_image_to_base64(image_path)
data_url = f"data:image/jpeg;base64,{base64_image}"

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What's in this image?"
            },
            {
                "type": "image_url",
                "image_url": {
                    "url": data_url
                }
            }
        ]
    }
]

payload = {
    "model": "{{MODEL}}",
    "messages": messages
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

```typescript title="TypeScript (fetch)"
async function encodeImageToBase64(imagePath: string): Promise<string> {
  const imageBuffer = await fs.promises.readFile(imagePath);
  const base64Image = imageBuffer.toString('base64');
  return `data:image/jpeg;base64,${base64Image}`;
}

// Read and encode the image
const imagePath = 'path/to/your/image.jpg';
const base64Image = await encodeImageToBase64(imagePath);

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: "What's in this image?",
          },
          {
            type: 'image_url',
            image_url: {
              url: base64Image,
            },
          },
        ],
      },
    ],
  }),
});

const data = await response.json();
console.log(data);
```

</CodeGroup>
</Template>

Supported image content types are:

- `image/png`
- `image/jpeg`
- `image/webp`
- `image/gif`

---
title: PDF Inputs
subtitle: How to send PDFs to OpenRouter models
headline: OpenRouter PDF Inputs | Complete Documentation
canonical-url: 'https://openrouter.ai/docs/guides/overview/multimodal/pdfs'
'og:site_name': OpenRouter Documentation
'og:title': OpenRouter PDF Inputs - Complete Documentation
'og:description': Send PDF documents to any model on OpenRouter.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?title=OpenRouter%20PDF%20Inputs&description=Send%20PDF%20documents%20to%20any%20model%20on%20OpenRouter.
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouter'
noindex: false
nofollow: false
---

  API_KEY_REF,
  DEFAULT_PDF_ENGINE,
  MISTRAL_OCR_USER_COST_PER_1K_PAGE_DOLLARS as MISTRAL_OCR_COST,
  PDFParserEngine,
} from '../../../../imports/constants';

OpenRouter supports PDF processing through the `/api/v1/chat/completions` API. PDFs can be sent as **direct URLs** or **base64-encoded data URLs** in the messages array, via the file content type. This feature works on **any** model on OpenRouter.

**URL support**: Send publicly accessible PDFs directly without downloading or encoding
**Base64 support**: Required for local files or private documents that aren't publicly accessible

PDFs also work in the chat room for interactive testing.

<Info>
  When a model supports file input natively, the PDF is passed directly to the
  model. When the model does not support file input natively, OpenRouter will
  parse the file and pass the parsed results to the requested model.
</Info>

<Tip>You can send both PDFs and other file types in the same request.</Tip>

## Plugin Configuration

To configure PDF processing, use the `plugins` parameter in your request. OpenRouter provides several PDF processing engines with different capabilities and pricing:

```typescript
{
  plugins: [
    {
      id: 'file-parser',
      pdf: {
        engine: 'cloudflare-ai', // or 'mistral-ocr' or 'native'
      },
    },
  ],
}
```

## Pricing

OpenRouter provides several PDF processing engines:

1. <code>"{PDFParserEngine.MistralOCR}"</code>: Best for scanned documents or
   PDFs with images (${MISTRAL_OCR_COST.toString()} per 1,000 pages).
2. <code>"{PDFParserEngine.CloudflareAI}"</code>: Converts PDFs to markdown
   using Cloudflare Workers AI (Free).
3. <code>"{PDFParserEngine.Native}"</code>: Only available for models that
   support file input natively (charged as input tokens).

<Info>
  The `"pdf-text"` engine is deprecated and automatically redirected to
  `"cloudflare-ai"`. Existing requests using `"pdf-text"` will continue to work.
</Info>

<Warning>
  OCR costs apply to all requests, including BYOK. OpenRouter uses its own Mistral
  key for OCR (not your BYOK key), so the per-page fee is always billed to your
  OpenRouter account.
</Warning>

If you don't explicitly specify an engine, OpenRouter will default first to the model's native file processing capabilities, and if that's not available, we will use the <code>"{DEFAULT_PDF_ENGINE}"</code> engine.

## OCR Image Limits

When the <code>"{PDFParserEngine.MistralOCR}"</code> engine extracts images from a PDF, OpenRouter requests at most **8 images per PDF** from Mistral via the OCR API's `image_limit` parameter, and forwards no more than 8 images per request to the downstream model. Surplus images are dropped while all extracted text is preserved in full.

This cap exists because per-prompt image limits vary significantly across providers — some reject requests with more than 8 images outright, and even providers with higher caps often fail with context-length errors when a long PDF emits one image per page. Capping at 8 keeps requests within the limits of every supported provider.

If your downstream model does not accept image input at all, OCR-extracted images are stripped entirely and only the parsed text is forwarded.

## Using PDF URLs

For publicly accessible PDFs, you can send the URL directly without needing to download and encode the file:

<Template data={{
  API_KEY_REF,
  MODEL: 'anthropic/claude-sonnet-4',
  ENGINE: PDFParserEngine.MistralOCR,
}}>
<CodeGroup>

```typescript title="TypeScript SDK"

const openRouter = new OpenRouter({
  apiKey: '{{API_KEY_REF}}',
});

const result = await openRouter.chat.send({
  model: '{{MODEL}}',
  messages: [
    {
      role: 'user',
      content: [
        {
          type: 'text',
          text: 'What are the main points in this document?',
        },
        {
          type: 'file',
          file: {
            filename: 'document.pdf',
            fileData: 'https://bitcoin.org/bitcoin.pdf',
          },
        },
      ],
    },
  ],
  // Optional: Configure PDF processing engine
  plugins: [
    {
      id: 'file-parser',
      pdf: {
        engine: '{{ENGINE}}',
      },
    },
  ],
  stream: false,
});

console.log(result);
```

```python

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What are the main points in this document?"
            },
            {
                "type": "file",
                "file": {
                    "filename": "document.pdf",
                    "file_data": "https://bitcoin.org/bitcoin.pdf"
                }
            },
        ]
    }
]

# Optional: Configure PDF processing engine
plugins = [
    {
        "id": "file-parser",
        "pdf": {
            "engine": "{{ENGINE}}"
        }
    }
]

payload = {
    "model": "{{MODEL}}",
    "messages": messages,
    "plugins": plugins
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

```typescript title="TypeScript (fetch)"
const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What are the main points in this document?',
          },
          {
            type: 'file',
            file: {
              filename: 'document.pdf',
              file_data: 'https://bitcoin.org/bitcoin.pdf',
            },
          },
        ],
      },
    ],
    // Optional: Configure PDF processing engine
    plugins: [
      {
        id: 'file-parser',
        pdf: {
          engine: '{{ENGINE}}',
        },
      },
    ],
  }),
});

const data = await response.json();
console.log(data);
```

</CodeGroup>
</Template>

<Info>
  PDF URLs work with all processing engines. For Mistral OCR, the URL is passed directly to the service. For other engines, OpenRouter fetches the PDF and processes it internally.
</Info>

## Using Base64 Encoded PDFs

For local PDF files or when you need to send PDF content directly, you can base64 encode the file:

<Template data={{
  API_KEY_REF,
  MODEL: 'google/gemma-3-27b-it',
  ENGINE: PDFParserEngine.CloudflareAI,
  DEFAULT_PDF_ENGINE,
}}>
<CodeGroup>

```python

from pathlib import Path

def encode_pdf_to_base64(pdf_path):
    with open(pdf_path, "rb") as pdf_file:
        return base64.b64encode(pdf_file.read()).decode('utf-8')

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

# Read and encode the PDF
pdf_path = "path/to/your/document.pdf"
base64_pdf = encode_pdf_to_base64(pdf_path)
data_url = f"data:application/pdf;base64,{base64_pdf}"

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What are the main points in this document?"
            },
            {
                "type": "file",
                "file": {
                    "filename": "document.pdf",
                    "file_data": data_url
                }
            },
        ]
    }
]

# Optional: Configure PDF processing engine
# PDF parsing will still work even if the plugin is not explicitly set
plugins = [
    {
        "id": "file-parser",
        "pdf": {
            "engine": "{{ENGINE}}"  # defaults to "{{DEFAULT_PDF_ENGINE}}". See Pricing above
        }
    }
]

payload = {
    "model": "{{MODEL}}",
    "messages": messages,
    "plugins": plugins
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

```typescript
async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await fs.promises.readFile(pdfPath);
  const base64PDF = pdfBuffer.toString('base64');
  return `data:application/pdf;base64,${base64PDF}`;
}

// Read and encode the PDF
const pdfPath = 'path/to/your/document.pdf';
const base64PDF = await encodePDFToBase64(pdfPath);

const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '{{MODEL}}',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: 'What are the main points in this document?',
          },
          {
            type: 'file',
            file: {
              filename: 'document.pdf',
              file_data: base64PDF,
            },
          },
        ],
      },
    ],
    // Optional: Configure PDF processing engine
    // PDF parsing will still work even if the plugin is not explicitly set
    plugins: [
      {
        id: 'file-parser',
        pdf: {
          engine: '{{ENGINE}}', // defaults to "{{DEFAULT_PDF_ENGINE}}". See Pricing above
        },
      },
    ],
  }),
});

const data = await response.json();
console.log(data);
```

</CodeGroup>
</Template>

## Skip Parsing Costs

When you send a PDF to the API, the response may include file annotations in the assistant's message. These annotations contain structured information about the PDF document that was parsed. By sending these annotations back in subsequent requests, you can avoid re-parsing the same PDF document multiple times, which saves both processing time and costs.

Here's how to reuse file annotations:

<Template data={{
  API_KEY_REF,
  MODEL: 'google/gemma-3-27b-it'
}}>
<CodeGroup>

```python

from pathlib import Path

# First, encode and send the PDF
def encode_pdf_to_base64(pdf_path):
    with open(pdf_path, "rb") as pdf_file:
        return base64.b64encode(pdf_file.read()).decode('utf-8')

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

# Read and encode the PDF
pdf_path = "path/to/your/document.pdf"
base64_pdf = encode_pdf_to_base64(pdf_path)
data_url = f"data:application/pdf;base64,{base64_pdf}"

# Initial request with the PDF
messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "What are the main points in this document?"
            },
            {
                "type": "file",
                "file": {
                    "filename": "document.pdf",
                    "file_data": data_url
                }
            },
        ]
    }
]

payload = {
    "model": "{{MODEL}}",
    "messages": messages
}

response = requests.post(url, headers=headers, json=payload)
response_data = response.json()

# Store the annotations from the response
file_annotations = None
if response_data.get("choices") and len(response_data["choices"]) > 0:
    if "annotations" in response_data["choices"][0]["message"]:
        file_annotations = response_data["choices"][0]["message"]["annotations"]

# Follow-up request using the annotations (without sending the PDF again)
if file_annotations:
    follow_up_messages = [
        {
            "role": "user",
            "content": [
                {
                    "type": "text",
                    "text": "What are the main points in this document?"
                },
                {
                    "type": "file",
                    "file": {
                        "filename": "document.pdf",
                        "file_data": data_url
                    }
                }
            ]
        },
        {
            "role": "assistant",
            "content": "The document contains information about...",
            "annotations": file_annotations
        },
        {
            "role": "user",
            "content": "Can you elaborate on the second point?"
        }
    ]

    follow_up_payload = {
        "model": "{{MODEL}}",
        "messages": follow_up_messages
    }

    follow_up_response = requests.post(url, headers=headers, json=follow_up_payload)
    print(follow_up_response.json())
```

```typescript

async function encodePDFToBase64(pdfPath: string): Promise<string> {
  const pdfBuffer = await fs.readFile(pdfPath);
  const base64PDF = pdfBuffer.toString('base64');
  return `data:application/pdf;base64,${base64PDF}`;
}

// Initial request with the PDF
async function processDocument() {
  // Read and encode the PDF
  const pdfPath = 'path/to/your/document.pdf';
  const base64PDF = await encodePDFToBase64(pdfPath);

  const initialResponse = await fetch(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY_REF}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: '{{MODEL}}',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What are the main points in this document?',
              },
              {
                type: 'file',
                file: {
                  filename: 'document.pdf',
                  file_data: base64PDF,
                },
              },
            ],
          },
        ],
      }),
    },
  );

  const initialData = await initialResponse.json();

  // Store the annotations from the response
  let fileAnnotations = null;
  if (initialData.choices && initialData.choices.length > 0) {
    if (initialData.choices[0].message.annotations) {
      fileAnnotations = initialData.choices[0].message.annotations;
    }
  }

  // Follow-up request using the annotations (without sending the PDF again)
  if (fileAnnotations) {
    const followUpResponse = await fetch(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${API_KEY_REF}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: '{{MODEL}}',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'What are the main points in this document?',
                },
                {
                  type: 'file',
                  file: {
                    filename: 'document.pdf',
                    file_data: base64PDF,
                  },
                },
              ],
            },
            {
              role: 'assistant',
              content: 'The document contains information about...',
              annotations: fileAnnotations,
            },
            {
              role: 'user',
              content: 'Can you elaborate on the second point?',
            },
          ],
        }),
      },
    );

    const followUpData = await followUpResponse.json();
    console.log(followUpData);
  }
}

processDocument();
```

</CodeGroup>
</Template>

<Info>
  When you include the file annotations from a previous response in your
  subsequent requests, OpenRouter will use this pre-parsed information instead
  of re-parsing the PDF, which saves processing time and costs. This is
  especially beneficial for large documents or when using the `mistral-ocr`
  engine which incurs additional costs.
</Info>

## File Annotations Schema

When OpenRouter parses a PDF, the response includes file annotations in the assistant message. Here is the TypeScript type for the annotation schema:

```typescript
type FileAnnotation = {
  type: 'file';
  file: {
    hash: string;           // Unique hash identifying the parsed file
    name?: string;          // Original filename (optional)
    content: ContentPart[]; // Parsed content from the file
  };
};

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };
```

The `content` array contains the parsed content from the PDF, which may include text blocks and images (as base64 data URLs). The `hash` field uniquely identifies the parsed file content and is used to skip re-parsing when you include the annotation in subsequent requests.

## Response Format

The API will return a response in the following format:

```json
{
  "id": "gen-1234567890",
  "provider": "DeepInfra",
  "model": "google/gemma-3-27b-it",
  "object": "chat.completion",
  "created": 1234567890,
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "The document discusses...",
        "annotations": [
          {
            "type": "file",
            "file": {
              "hash": "abc123...",
              "name": "document.pdf",
              "content": [
                { "type": "text", "text": "Parsed text content..." },
                { "type": "image_url", "image_url": { "url": "data:image/png;base64,..." } }
              ]
            }
          }
        ]
      }
    }
  ],
  "usage": {
    "prompt_tokens": 1000,
    "completion_tokens": 100,
    "total_tokens": 1100
  }
}
```

## Error Responses with Parsed Annotations

If OpenRouter successfully parses your PDF but every inference provider then fails to generate a completion, the error response still includes the parsed annotations under `error.metadata.file_annotations`. The shape matches the success-path `FileAnnotation` documented above, so you can hand the same array straight back to OpenRouter on a retry to skip re-parsing.

This applies to the <code>"{PDFParserEngine.MistralOCR}"</code> and <code>"{PDFParserEngine.CloudflareAI}"</code> engines, which parse the PDF before sending it to a model. The <code>"{PDFParserEngine.Native}"</code> engine doesn't produce annotations because the file is forwarded directly to the model.

```json
{
  "error": {
    "code": 502,
    "message": "Provider returned an error",
    "metadata": {
      "file_annotations": [
        {
          "type": "file",
          "file": {
            "hash": "abc123...",
            "name": "document.pdf",
            "content": [
              { "type": "text", "text": "Parsed text content..." }
            ]
          }
        }
      ]
    }
  }
}
```

When you read annotations from both the success and error paths, dedupe by `file.hash` — the hash is stable across both shapes for the same parsed file:

```typescript
function isFileAnnotation(value: unknown): value is FileAnnotation {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { type?: unknown; file?: { hash?: unknown } };
  return (
    candidate.type === 'file' &&
    typeof candidate.file?.hash === 'string'
  );
}

function extractFileAnnotations(response: unknown): FileAnnotation[] {
  if (typeof response !== 'object' || response === null) return [];

  const root = response as {
    choices?: Array<{ message?: { annotations?: unknown[] } }>;
    error?: { metadata?: { file_annotations?: unknown[] } };
  };

  const fromMessage = root.choices?.[0]?.message?.annotations ?? [];
  const fromError = root.error?.metadata?.file_annotations ?? [];

  const seen = new Set<string>();
  const out: FileAnnotation[] = [];
  for (const a of [...fromMessage, ...fromError]) {
    if (isFileAnnotation(a) && !seen.has(a.file.hash)) {
      seen.add(a.file.hash);
      out.push(a);
    }
  }
  return out;
}
```

---
title: Audio
subtitle: How to send and receive audio with OpenRouter models
headline: OpenRouter Audio | Complete Documentation
canonical-url: 'https://openrouter.ai/docs/guides/overview/multimodal/audio'
'og:site_name': OpenRouter Documentation
'og:title': OpenRouter Audio - Complete Documentation
'og:description': >-
  Send audio files to and receive audio responses from speech-capable models
  through the OpenRouter API.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?title=OpenRouter%20Audio&description=Send%20and%20receive%20audio%20with%20speech-capable%20models%20through%20the%20OpenRouter%20API.
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouter'
noindex: false
nofollow: false
---

OpenRouter supports both sending audio files to compatible models and receiving audio responses via the API. This guide covers how to work with audio inputs and outputs.

## Audio Inputs

Send audio files to compatible models for transcription, analysis, and processing. Audio input requests use the `/api/v1/chat/completions` API with the `input_audio` content type. Audio files must be base64-encoded and include the format specification.

**Note**: Audio files must be **base64-encoded** - direct URLs are not supported for audio content.

You can search for models that support audio input by filtering to audio input modality on our [Models page](/models?fmt=cards&input_modalities=audio).

### Sending Audio Files

Here's how to send an audio file for processing:

<Template data={{
  API_KEY_REF,
  MODEL: 'google/gemini-2.5-flash'
}}>
<CodeGroup>

```typescript title="TypeScript SDK"

const openRouter = new OpenRouter({
  apiKey: '{{API_KEY_REF}}',
});

async function encodeAudioToBase64(audioPath: string): Promise<string> {
  const audioBuffer = await fs.readFile(audioPath);
  return audioBuffer.toString("base64");
}

// Read and encode the audio file
const audioPath = "path/to/your/audio.wav";
const base64Audio = await encodeAudioToBase64(audioPath);

const result = await openRouter.chat.send({
  model: "{{MODEL}}",
  messages: [
    {
      role: "user",
      content: [
        {
          type: "text",
          text: "Please transcribe this audio file.",
        },
        {
          type: "input_audio",
          inputAudio: {
            data: base64Audio,
            format: "wav",
          },
        },
      ],
    },
  ],
  stream: false,
});

console.log(result);
```

```python

def encode_audio_to_base64(audio_path):
    with open(audio_path, "rb") as audio_file:
        return base64.b64encode(audio_file.read()).decode('utf-8')

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

# Read and encode the audio file
audio_path = "path/to/your/audio.wav"
base64_audio = encode_audio_to_base64(audio_path)

messages = [
    {
        "role": "user",
        "content": [
            {
                "type": "text",
                "text": "Please transcribe this audio file."
            },
            {
                "type": "input_audio",
                "input_audio": {
                    "data": base64_audio,
                    "format": "wav"
                }
            }
        ]
    }
]

payload = {
    "model": "{{MODEL}}",
    "messages": messages
}

response = requests.post(url, headers=headers, json=payload)
print(response.json())
```

```typescript title="TypeScript (fetch)"

async function encodeAudioToBase64(audioPath: string): Promise<string> {
  const audioBuffer = await fs.readFile(audioPath);
  return audioBuffer.toString("base64");
}

// Read and encode the audio file
const audioPath = "path/to/your/audio.wav";
const base64Audio = await encodeAudioToBase64(audioPath);

const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "{{MODEL}}",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Please transcribe this audio file.",
          },
          {
            type: "input_audio",
            input_audio: {
              data: base64Audio,
              format: "wav",
            },
          },
        ],
      },
    ],
  }),
});

const data = await response.json();
console.log(data);
```

</CodeGroup>
</Template>

### Supported Audio Input Formats

Supported audio formats vary by provider. Common formats include:

- `wav` - WAV audio
- `mp3` - MP3 audio
- `aiff` - AIFF audio
- `aac` - AAC audio
- `ogg` - OGG Vorbis audio
- `flac` - FLAC audio
- `m4a` - M4A audio
- `pcm16` - PCM16 audio
- `pcm24` - PCM24 audio

**Note:** Check your model's documentation to confirm which audio formats it supports. Not all models support all formats.

## Audio Output

OpenRouter supports receiving audio responses from models that have audio output capabilities. To request audio output, include the `modalities` and `audio` parameters in your request.

You can search for models that support audio output by filtering to audio output modality on our [Models page](/models?fmt=cards&output_modalities=audio).

### Requesting Audio Output

To receive audio output, set `modalities` to `["text", "audio"]` and provide the `audio` configuration with your desired voice and format:

<Template data={{
  API_KEY_REF,
  MODEL: 'openai/gpt-4o-audio-preview'
}}>
<CodeGroup>

```python

url = "https://openrouter.ai/api/v1/chat/completions"
headers = {
    "Authorization": f"Bearer {API_KEY_REF}",
    "Content-Type": "application/json"
}

payload = {
    "model": "{{MODEL}}",
    "messages": [
        {
            "role": "user",
            "content": "Say hello in a friendly tone."
        }
    ],
    "modalities": ["text", "audio"],
    "audio": {
        "voice": "alloy",
        "format": "wav"
    },
    "stream": True
}

# Audio output requires streaming — the response is delivered as SSE chunks
response = requests.post(url, headers=headers, json=payload, stream=True)

audio_data_chunks = []
transcript_chunks = []

for line in response.iter_lines():
    if not line:
        continue
    decoded = line.decode("utf-8")
    if not decoded.startswith("data: "):
        continue
    data = decoded[len("data: "):]
    if data.strip() == "[DONE]":
        break
    chunk = json.loads(data)
    delta = chunk["choices"][0].get("delta", {})
    audio = delta.get("audio", {})
    if audio.get("data"):
        audio_data_chunks.append(audio["data"])
    if audio.get("transcript"):
        transcript_chunks.append(audio["transcript"])

transcript = "".join(transcript_chunks)
print(f"Transcript: {transcript}")

# Combine and decode the base64 audio chunks, then save
full_audio_b64 = "".join(audio_data_chunks)
audio_bytes = base64.b64decode(full_audio_b64)
with open("output.wav", "wb") as f:
    f.write(audio_bytes)
```

```typescript title="TypeScript (fetch)"
const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${API_KEY_REF}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model: "{{MODEL}}",
    messages: [
      {
        role: "user",
        content: "Say hello in a friendly tone.",
      },
    ],
    modalities: ["text", "audio"],
    audio: {
      voice: "alloy",
      format: "wav",
    },
    stream: true,
  }),
});

// Audio output requires streaming — parse the SSE chunks
const reader = response.body!.getReader();
const decoder = new TextDecoder();

const audioDataChunks: string[] = [];
const transcriptChunks: string[] = [];
let buffer = "";

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  buffer += decoder.decode(value, { stream: true });
  const lines = buffer.split("\n");
  buffer = lines.pop()!; // keep incomplete line in buffer

  for (const line of lines) {
    if (!line.startsWith("data: ")) continue;
    const data = line.slice("data: ".length).trim();
    if (data === "[DONE]") break;

    const chunk = JSON.parse(data);
    const audio = chunk.choices?.[0]?.delta?.audio;
    if (audio?.data) audioDataChunks.push(audio.data);
    if (audio?.transcript) transcriptChunks.push(audio.transcript);
  }
}

const transcript = transcriptChunks.join("");
console.log(`Transcript: ${transcript}`);

// audioDataChunks joined together is the full base64-encoded audio
const fullAudioB64 = audioDataChunks.join("");
```

</CodeGroup>
</Template>

### Streaming Chunk Format

Audio output requires streaming (`stream: true`). Audio data and transcript are delivered incrementally via the `delta.audio` field in each chunk:

```json
{
  "choices": [
    {
      "delta": {
        "audio": {
          "data": "<base64-encoded audio chunk>",
          "transcript": "Hello"
        }
      }
    }
  ]
}
```

### Audio Configuration Options

The `audio` parameter accepts the following options:

| Option | Description |
|---|---|
| `voice` | The voice to use for audio generation (e.g., `alloy`, `echo`, `fable`, `onyx`, `nova`, `shimmer`). Available voices vary by model. |
| `format` | The audio format for the output (e.g., `wav`, `mp3`, `flac`, `opus`, `pcm16`). Available formats vary by model. |

---
title: Speech-to-Text
subtitle: How to transcribe audio into text with OpenRouter models
headline: OpenRouter Speech-to-Text (STT) | Complete Documentation
canonical-url: 'https://openrouter.ai/docs/guides/overview/multimodal/stt'
'og:site_name': OpenRouter Documentation
'og:title': OpenRouter Speech-to-Text - Complete Documentation
'og:description': >-
  Transcribe audio into text using AI models through the OpenRouter API. Access
  multiple STT providers with a single unified interface.
'og:image':
  type: url
  value: >-
    https://openrouter.ai/dynamic-og?title=OpenRouter%20Speech-to-Text&description=Transcribe%20audio%20into%20text%20using%20AI%20models%20through%20the%20OpenRouter%20API.
'og:image:width': 1200
'og:image:height': 630
'twitter:card': summary_large_image
'twitter:site': '@OpenRouter'
noindex: false
nofollow: false
---

  API_KEY_REF,
} from '../../../../imports/constants';

OpenRouter supports speech-to-text (STT) via a dedicated `/api/v1/audio/transcriptions` endpoint. Send base64-encoded audio and receive a JSON response with the transcribed text and usage statistics.

## Model Discovery

You can find STT models in several ways:

### Via the API

Use the `output_modalities` query parameter on the [Models API](/docs/api-reference/models/get-models) to discover STT models:

```bash
# List only STT models
curl "https://openrouter.ai/api/v1/models?output_modalities=transcription"
```

### On the Models Page

Visit the [Models page](/models) and filter by output modalities to find models capable of audio transcription. You can also browse the [Speech-to-Text collection](/collections/speech-to-text-models) for a curated list.

## API Usage

Send a `POST` request to `/api/v1/audio/transcriptions` with a JSON body containing base64-encoded audio. The response is JSON with the transcribed text and optional usage statistics.

### Basic Example

<Template data={{
  API_KEY_REF,
  MODEL: 'openai/whisper-1'
}}>
<CodeGroup>

```typescript title="TypeScript SDK"

const openRouter = new OpenRouter({
  apiKey: '{{API_KEY_REF}}',
});

const audioBuffer = await fs.promises.readFile('audio.wav');
const base64Audio = audioBuffer.toString('base64');

const result = await openRouter.stt.createTranscription({
  model: '{{MODEL}}',
  inputAudio: {
    data: base64Audio,
    format: 'wav',
  },
});

console.log(result.text);
```

```python title="Python"

with open("audio.wav", "rb") as f:
    base64_audio = base64.b64encode(f.read()).decode("utf-8")

response = requests.post(
    url="https://openrouter.ai/api/v1/audio/transcriptions",
    headers={
        "Authorization": "Bearer {{API_KEY_REF}}",
        "Content-Type": "application/json"
    },
    data=json.dumps({
        "model": "{{MODEL}}",
        "input_audio": {
            "data": base64_audio,
            "format": "wav"
        }
    })
)

result = response.json()
print(result["text"])
```

```typescript title="TypeScript (fetch)"

const audioBuffer = await fs.promises.readFile('audio.wav');
const base64Audio = audioBuffer.toString('base64');

const response = await fetch('https://openrouter.ai/api/v1/audio/transcriptions', {
  method: 'POST',
  headers: {
    Authorization: `Bearer {{API_KEY_REF}}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    model: '{{MODEL}}',
    input_audio: {
      data: base64Audio,
      format: 'wav',
    },
  }),
});

const result = await response.json();
console.log(result.text);
```

```bash title="cURL"
# Base64-encode your audio file
AUDIO_BASE64=$(base64 < audio.wav | tr -d '\n')

curl https://openrouter.ai/api/v1/audio/transcriptions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $OPENROUTER_API_KEY" \
  -d '{
    "model": "{{MODEL}}",
    "input_audio": {
      "data": "'"$AUDIO_BASE64"'",
      "format": "wav"
    }
  }'
```

</CodeGroup>
</Template>

### Request Parameters

| Parameter | Type | Required | Description |
|---|---|---|---|
| `model` | string | Yes | The STT model to use (e.g., `openai/whisper-1`) |
| `input_audio` | object | Yes | Audio data to transcribe |
| `input_audio.data` | string | Yes | Base64-encoded audio data (raw bytes, not a data URI) |
| `input_audio.format` | string | Yes | Audio format (e.g., `wav`, `mp3`, `flac`, `m4a`, `ogg`, `webm`, `aac`) |
| `language` | string | No | ISO-639-1 language code (e.g., `"en"`, `"ja"`). Auto-detected if omitted |
| `temperature` | number | No | Sampling temperature between 0 and 1. Lower values produce more deterministic results |
| `provider` | object | No | Provider-specific passthrough configuration |

### Provider-Specific Options

You can pass provider-specific options using the `provider` parameter. Options are keyed by provider slug, and only the options for the matched provider are forwarded:

```json
{
  "model": "openai/whisper-large-v3",
  "input_audio": {
    "data": "UklGRiQA...",
    "format": "wav"
  },
  "provider": {
    "options": {
      "groq": {
        "prompt": "Expected vocabulary: OpenRouter, API, transcription"
      }
    }
  }
}
```

## Response Format

The STT endpoint returns a JSON response with the transcribed text:

```json
{
  "text": "Hello, this is a test of speech-to-text transcription.",
  "usage": {
    "seconds": 9.2,
    "total_tokens": 113,
    "input_tokens": 83,
    "output_tokens": 30,
    "cost": 0.000508
  }
}
```

### Response Fields

| Field | Type | Description |
|---|---|---|
| `text` | string | The transcribed text |
| `usage.seconds` | number | Duration of the input audio in seconds |
| `usage.total_tokens` | number | Total number of tokens used (input + output) |
| `usage.input_tokens` | number | Number of input tokens billed |
| `usage.output_tokens` | number | Number of output tokens generated |
| `usage.cost` | number | Total cost of the request in USD |

### Response Headers

| Header | Description |
|---|---|
| `X-Generation-Id` | Unique generation ID for the request, useful for tracking and debugging |

## Supported Audio Formats

Supported audio formats vary by provider. Common formats include:

| Format | MIME Type | Description |
|---|---|---|
| `wav` | `audio/wav` | Uncompressed audio, highest quality |
| `mp3` | `audio/mpeg` | Compressed audio, widely compatible |
| `flac` | `audio/flac` | Lossless compressed audio |
| `m4a` | `audio/mp4` | MPEG-4 audio |
| `ogg` | `audio/ogg` | Ogg Vorbis audio |
| `webm` | `audio/webm` | WebM audio, common in browser recordings |
| `aac` | `audio/aac` | Advanced Audio Coding |

## Pricing

STT models use different pricing strategies depending on the provider:

- **Duration-based** (e.g., OpenAI Whisper): Priced per second of audio input
- **Token-based** (e.g., newer OpenAI models): Priced per input/output token, similar to text models

You can check the cost for each model on the [Models page](/models) or via the [Models API](/docs/api-reference/models/get-models). The `usage.cost` field in the response shows the actual cost for each request.

## BYOK (Bring Your Own Key)

STT supports [BYOK](/docs/guides/overview/auth/byok), allowing you to use your own provider API keys. When configured, requests are routed directly to the provider using your key, and OpenRouter charges only its platform fee rather than the per-usage model cost.

## Playground

You can test STT models directly in the browser using the [OpenRouter Playground](/playground). Navigate to any STT model's page and use the playground tab to upload an audio file and see the transcription result.

## Differences from Audio Input

OpenRouter supports two ways to process audio:

1. **Speech-to-Text** (this page): A dedicated `/api/v1/audio/transcriptions` endpoint optimized for transcription. Returns structured JSON with the transcribed text and usage data. Best for converting audio to text.

2. **Audio input via Chat Completions** ([Audio docs](/docs/features/multimodal/audio)): Send audio as part of a `/api/v1/chat/completions` request using the `input_audio` content type. The model processes the audio alongside text and responds conversationally. Best for audio analysis, question answering about audio content, or combining audio with other modalities.

## Best Practices

- **Choose the right format**: WAV provides the best quality for transcription. MP3 and other compressed formats work well but may slightly reduce accuracy for borderline audio
- **File size**: For very long audio files, consider splitting them into smaller segments. The upstream provider timeout is 60 seconds, so very large files may time out
- **Base64 encoding**: Audio must be sent as base64-encoded data (raw bytes, not a data URI). Most programming languages have built-in base64 encoding utilities

## Troubleshooting

**Empty or incorrect transcription?**
- Verify the audio format matches the `format` field in your request
- Ensure the audio quality is sufficient for transcription

**Request timing out?**
- Large audio files may exceed the 60-second timeout. Split long recordings into smaller segments
- Compressed formats (MP3, AAC) produce smaller payloads and transfer faster

**Model not found?**
- Use the [Models page](/models) or the [Models API](/docs/api-reference/models/get-models) with `output_modalities=transcription` to find available STT models
- Verify the model slug is correct (e.g., `openai/whisper-1`, not `whisper-1`)

**Authentication error?**
- Ensure you're using a valid API key from [your OpenRouter dashboard](/settings/keys)
- The STT endpoint uses the same authentication as the Chat Completions API