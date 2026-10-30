# Insights

## Algorithms hiding inside the boxes

Most system design interviews at the senior level aren't about boxes and arrows. They're about the algorithms hiding inside those boxes.

When an interviewer asks "How do you shard without reshuffling everything?" or "How do replicas find what's different?", they are checking whether you know the building blocks that power Dynamo, Cassandra, Kafka and Redis. Here are 10 that come up again and again:

| # | Algorithm | What it buys you |
| --- | --- | --- |
| 1 | **Consistent Hashing** | Scale shards, move only ~1/N of keys |
| 2 | **Bloom Filter** | "Definitely not here" in a few bits |
| 3 | **Token Bucket** | Rate limiting with bursts |
| 4 | **Raft** | Leader election + majority commit |
| 5 | **Gossip Protocol** | Cluster membership in O(log N) rounds |
| 6 | **Merkle Tree** | Find divergent data between replicas cheaply |
| 7 | **Geohash & Quadtree** | "Find drivers within 2 km" |
| 8 | **HyperLogLog** | Count billions of uniques in 12 KB |
| 9 | **Vector Clocks** | Detect concurrent writes and conflicts |
| 10 | **LSM Tree** | Millions of writes per second |

Each one has a definition, a visual, a place where it is used in production, and an interview question that should trigger it.

**Key insight:** you don't need to derive the math. You need to know *when* to reach for each one and *what trade-off* it buys you.

*Which one have you been asked about most?*

---

## Original post

::linkedin urn:li:share:7521638052172288001 1699 "LinkedIn post: 10 algorithms behind system design"
