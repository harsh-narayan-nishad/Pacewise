# System Design 1

Reference notes for system-design preparation: the three network performance terms, a full cheatsheet, and the process to follow in an interview.

## 1. Latency vs Throughput vs Bandwidth

*Explained in 2 minutes or less.*

| | Latency | Throughput | Bandwidth |
| --- | --- | --- | --- |
| **What it is** | Time taken for data to travel from source to destination | Actual amount of data successfully transferred per second | Maximum data transfer capacity of a network link |
| **Analogy** | Time it takes a car to travel from A to B | Number of cars passing a point on a highway per second | Number of lanes on a highway |
| **How it is measured** | Often using ping (round-trip time) | Speed tests or transfer metrics | Depends on link technology and network configuration |
| **Why it matters** | Lower latency improves responsiveness in API requests, gaming and video calls | Higher throughput enables faster file transfers, video streaming and data pipelines | Higher bandwidth supports simultaneous transfers and data-intensive workloads |
| **Check** | Physical distance, network congestion, processing and queuing delays | Available bandwidth, packet loss and protocol overhead | Link technology, network configuration and shared capacity |

**Anything else you'd add?** Bandwidth is the ceiling, throughput is what you actually get, and latency is how long each piece takes — a link can have huge bandwidth and still feel slow if latency is high.

---

## 2. System Design Cheatsheet

Most people think System Design is about drawing boxes. It isn't. It's about making the right engineering decisions.

![System Design Cheatsheet (intermediate level) — Swadesh Kumar](/docs/system-design-cheatsheet.png)

| 1. Start with the Design Process | 2. Learn the Core Components | 3. Master Scaling |
| --- | --- | --- |
| ☑ Understand the requirements<br>☑ Define goals and constraints<br>☑ Create a high-level design<br>☑ Dive into detailed design<br>☑ Identify bottlenecks<br>☑ Scale and optimize<br>☑ Review trade-offs | ☑ Load Balancer → distributes traffic<br>☑ Application Server → runs business logic<br>☑ Cache (Redis) → faster reads<br>☑ Database → stores persistent data<br>☑ Message Queue → async communication<br>☑ Object Storage → files and media<br>☑ CDN → faster global content delivery | ☑ Vertical Scaling → upgrade one server<br>☑ Horizontal Scaling → add more servers<br>☑ Load Balancing<br>☑ Auto Scaling<br>☑ Replication<br>☑ Failover |

| 4. Choose the Right Storage | 5. Learn Common Design Patterns | 6. Know These Concepts |
| --- | --- | --- |
| ☑ SQL → structured, ACID transactions<br>☑ NoSQL → high scalability and flexibility<br>☑ Cache → low-latency access<br>☑ Object Storage → images, videos and backups | ☑ Microservices<br>☑ API Gateway<br>☑ CQRS<br>☑ Event-Driven Architecture<br>☑ Leader Election | ☑ Latency<br>☑ Throughput<br>☑ Availability<br>☑ Reliability<br>☑ Fault Tolerance<br>☑ Consistency<br>☑ Idempotency |

| 7. Never Skip Estimation | 8. Every Interview Comes Down to Trade-offs | The one-line summary |
| --- | --- | --- |
| ☑ QPS (Queries Per Second)<br>☑ Storage<br>☑ Bandwidth<br>☑ Memory<br>☑ Growth rate | ☑ Consistency vs Availability<br>☑ Performance vs Cost<br>☑ Scalability vs Complexity<br>☑ Latency vs Throughput<br>☑ SQL vs NoSQL | Most candidates memorize architectures. Strong engineers understand why they are built that way. |

**System Design is simply:**

1. Understand the problem.
2. Estimate the scale.
3. Choose the right components.
4. Optimize bottlenecks.
5. Explain your trade-offs.

*Best resources:* System Design Primer (GitHub), High Scalability (arpitbhayani.me), Design Gurus (designgurus.org), Educative — Grokking the System Design Interview, AWS Architecture Icons / AWS Docs (as listed on the cheatsheet image).

---

## Original post

::linkedin urn:li:share:7514296223722467328 1531 "LinkedIn post: system design"
