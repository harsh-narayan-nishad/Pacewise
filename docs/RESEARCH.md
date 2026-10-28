# Research

This guide connects the product direction—**read, revise, track progress, and
share**—to public engineering references and core computer science concepts.
It is a study guide, not a claim that every capability below is already
implemented or that the project needs every technology mentioned.

## How to use this guide

Start with the product problem and its measurable requirements. Use the
references to understand options and trade-offs, then choose the simplest
design that meets those requirements. Systems described by Google or Uber are
useful case studies, not blueprints that a solo project should copy.

## Product and engineering references

### Reading and PDF experience

- [PDF.js](https://github.com/mozilla/pdf.js) — A browser-based PDF viewer.
  Study page rendering, zoom, and coordinate mapping before implementing
  annotations that must stay attached to a page as it is resized or rotated.
  **Trade-off:** PDF rendering is only one part of document editing; annotation
  persistence, permissions, and synchronization are separate concerns.
- [OCRmyPDF documentation](https://ocrmypdf.readthedocs.io/en/latest/) and
  [Tesseract](https://github.com/tesseract-ocr/tesseract) — References for
  making scanned PDFs text-searchable and for OCR engines. **Trade-off:** OCR
  quality varies with scan quality, language, layout, and handwriting. Measure
  it on representative documents; searchable text is not the same as visual
  understanding.
- [AWS S3 multipart uploads](https://docs.aws.amazon.com/AmazonS3/latest/userguide/mpuoverview.html)
  and the [tus resumable upload protocol](https://tus.io/protocols/resumable-upload)
  — Learn chunked or resumable uploads, retries, checksums, and incomplete
  upload cleanup. **Trade-off:** multipart upload and tus solve related but
  different integration problems. Choose based on the storage provider,
  deployment, and resume requirements rather than adding both by default.
- [MDN HTTP caching](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching)
  — Understand browser and shared caches when serving content through a CDN.
  **Trade-off:** caching can reduce latency and bandwidth, but private files
  and user-specific responses need careful cache controls.

### Search, collaboration, and revision

- [Yjs documentation](https://docs.yjs.dev/) and
  [Yjs repository](https://github.com/yjs/yjs) — A practical reference for
  shared editing and merging concurrent changes. **Trade-off:** a CRDT can
  help merge edits, but does not provide authorization, persistence, or a
  complete collaboration product.
- [OpenSearch vector search](https://docs.opensearch.org/latest/vector-search/)
  and [pgvector](https://github.com/pgvector/pgvector) — References for
  semantic retrieval and vector similarity. **Trade-off:** a separate search
  service offers dedicated search capabilities but adds operations; keeping
  vectors in PostgreSQL may simplify a smaller system but has its own scaling
  and query trade-offs. Search quality also depends on extraction, chunking,
  embeddings, and evaluation.
- [FSRS](https://github.com/open-spaced-repetition/fsrs4anki) — A reference
  for spaced-repetition scheduling. **Trade-off:** a scheduling algorithm
  should be judged by learner outcomes and review history, not by the model
  name alone.

### Code writing and formatting

- [CodeMirror 6 guide](https://codemirror.net/docs/guide/) and
  [Monaco Editor](https://github.com/microsoft/monaco-editor) — Study two
  established browser editor approaches. **Trade-off:** compare needed
  language support, bundle size, mobile behavior, and extension needs before
  choosing one.
- [Prettier documentation](https://prettier.io/docs/) — A reference for
  parser-based formatting. **Trade-off:** identifying a language and formatting
  its source are separate tasks; formatters support specific languages and
  syntax.

### Reliability and system design

- [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/)
  — Learn to define measurable service goals, such as document-open latency,
  upload completion, search response time, and successful saves. **Trade-off:**
  higher reliability targets can increase infrastructure and engineering cost.
- [Google SRE: Monitoring Distributed Systems](https://sre.google/sre-book/monitoring-distributed-systems/)
  and [OpenTelemetry](https://opentelemetry.io/docs/) — Learn to use metrics,
  logs, and traces to find failures and bottlenecks. **Trade-off:** more
  telemetry improves visibility but adds storage, cost, and maintenance; start
  with signals tied to user-visible outcomes.
- [Uber Engineering: Kafka at Uber](https://www.uber.com/blog/kafka/) and
  [Apache Kafka](https://github.com/apache/kafka) — A case study in event
  streaming at large scale. **Trade-off:** queues and event streams can isolate
  slow document-processing jobs, but a distributed broker adds operational
  complexity. Adopt one when the workload calls for it, not just for scale
  optics.
- [Google Research: Spanner](https://research.google/pubs/spanner-googles-globally-distributed-database/)
  — A case study in globally distributed consistency. **Trade-off:** strong
  cross-region guarantees are complex and costly; most early systems should
  first establish their actual consistency and availability needs.
- [Google Research: Zanzibar](https://research.google/pubs/zanzibar-googles-consistent-global-authorization-system/)
  — A large-scale authorization case study relevant to sharing documents.
  **Trade-off:** fine-grained permission systems can be powerful but are harder
  to reason about and test than a small, explicit access model.

## Connections to core computer science

These are useful ways to explain engineering choices in a design review or
interview. They are concepts to apply where relevant, not a checklist requiring
extra infrastructure.

| Area | Connection to this product | Example trade-off |
|---|---|---|
| **OOP and design** | Encapsulation keeps reading state, document operations, and persistence behind clear interfaces. Strategy-style components can make reading modes or scheduling policies replaceable; repository interfaces can separate storage from product logic. | More abstractions improve testability and replacement, but too many layers slow a small product and obscure simple behavior. |
| **Computer networks (CN)** | HTTP APIs connect clients and services; resumable uploads handle unreliable connections; CDNs cache suitable content; WebSockets or similar transports can support live collaboration. | Caching and parallel transfer improve performance, but introduce invalidation, retry, ordering, and privacy concerns. Live synchronization is more responsive, but more complex than periodic saves. |
| **Operating systems (OS)** | PDF conversion, OCR, and indexing are CPU- and memory-intensive work. Background workers keep long jobs away from interactive request handling; process limits and isolation help control resource use. | More workers increase throughput only until CPU, memory, storage, or provider limits become the bottleneck. Isolation improves safety but consumes resources and adds deployment work. |
| **Database management (DBMS)** | Users, documents, permissions, annotations, reading sessions, and revision events need data models, indexes, and clear ownership. Transactions protect related updates; tenant-aware authorization helps prevent cross-user data access. | Normalization reduces duplicated data but may require joins; denormalized read models can speed dashboards but need reliable updates. Stronger consistency can cost latency or throughput. |

## Suggested study order

1. Define the core user journey and measurable outcomes.
2. Study PDF.js, upload protocols, and HTTP caching for document handling.
3. Study SLOs and OpenTelemetry for reliability and diagnosis.
4. Study Yjs and authorization only when shared editing and permissions are in scope.
5. Study OCR/search and FSRS against representative documents and learning data.
6. Compare editor options only after defining the code editor's required features.

For every design, be ready to explain the requirement, alternatives considered,
chosen trade-off, and how the result will be tested. That is more useful than
claiming a system is “Google-scale” before its workload and targets are known.
