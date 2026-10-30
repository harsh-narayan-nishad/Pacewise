# Challenges

## 8 hidden System Design problems and how to fix them

Your system handles thousands of requests perfectly. Then traffic increases, a cache expires, or one service becomes unavailable. Suddenly response times increase, requests fail, and problems start spreading across the system. These are the challenges that make System Design difficult at scale — and solving them requires more than adding servers.

Original post (saved to revisit): [https://lnkd.in/p/g35wJwn2](https://lnkd.in/p/g35wJwn2)

![8 Hidden System Design Problems and How to Fix Them — Shalini Goyal](/docs/hidden-system-design-problems.png)

| 1. Cache Stampede | 2. Hot Partitions | 3. Duplicate Requests | 4. Cascading Failures |
| --- | --- | --- | --- |
| When a popular cache entry expires, multiple requests hit the database simultaneously.<br>**Solution:** use request coalescing so only one request rebuilds the cache while others wait. | A single frequently accessed key can overload one database shard.<br>**Solution:** distribute traffic with techniques like key salting to reduce concentrated load. | Network retries can accidentally process the same payment or transaction multiple times.<br>**Solution:** use idempotency keys to recognize repeated requests and prevent duplicate operations. | When one service fails, dependent services can become overloaded and fail too.<br>**Solution:** implement circuit breakers to stop repeated calls to unhealthy dependencies. |

| 5. Traffic Spikes | 6. Dual-Write Bugs | 7. Distributed Transactions | 8. Queue Backlogs |
| --- | --- | --- | --- |
| Sudden bursts of requests can overwhelm application resources.<br>**Solution:** use token bucket rate limiting to control traffic while allowing manageable bursts. | Updating a database and publishing an event separately can create inconsistent states.<br>**Solution:** use the Transactional Outbox pattern with CDC to reliably publish committed changes. | A multi-service workflow can partially fail, leaving operations incomplete.<br>**Solution:** apply the Saga pattern with compensating actions to manage failures across services. | When messages arrive faster than consumers process them, delays keep growing.<br>**Solution:** scale consumers based on queue lag and use Dead Letter Queues for failed messages. |

**The goal:** build systems that remain reliable even when individual components fail.

Credit: Shalini Goyal — [LinkedIn profile](https://www.linkedin.com/in/goyalshalini/). Her book *System Design and Behavioral Intelligence* is available internationally: [US](https://lnkd.in/eVy2ACxQ) · [UK](https://lnkd.in/evzmHKm4) · [India](https://lnkd.in/e25PthqU).
