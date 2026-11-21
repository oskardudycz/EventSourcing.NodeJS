# Todo: EDA workshop exercise 05 Optimistic concurrency aligned in Node.js, .NET and JVM

Plan: `plan.md` (r14). Spec: `spec.md` (r27).

## Steps

- [x] 1. Node.js database and message bus are asynchronous from 02 (1.1–1.10)
- [x] 2. .NET `GetAll` is named `FindAll`, as in JVM and Node.js (14.1)
- [x] 3. The 05 exercise is the 04 solution plus what 05 adds (2.1–2.9, 3.1–3.2, 4.1–4.4, 6.1–6.2, 9.1–9.3)
- [x] 4. Every 05 facade method has a concurrency test, next to its module (5.1–5.7, 7.1–7.3, 8.1)
- [x] 5. One rule for a missing entity from 02 to 05 (12.1–12.5)
- [x] 6. The JVM 03 transactions solution and `Database.transaction` just work (13.1–13.3)
- [x] 7. 05 README and full verification (10.1–10.3, 11.1–11.4, 11.6)
- [x] 8. The JVM `Database.transaction` behaves like serializable isolation (13.2–13.3)
- [x] 9. JVM and .NET immutable entities mark a missing entity with a "not existing" status (17.1)
- [x] 10. Two 05 solutions: retry in the facade, and retry in the infrastructure (15.1–15.6, 15.8, 2.3, 4.1–4.4)
- [x] 11. JVM Kafka and RabbitMQ tests print no warning; Node.js 05 README note (16.1, 18.1)
- [x] 12. Full verification after the post-run changes (11.1–11.4, 11.6)
- [x] 13. Fixes after the second run (19.1–19.6)
- [x] 14. Reliable concurrency tests and a failing nested transaction (20.1–20.4)
- [x] 15. Concurrency tests start their calls together and read Given/When/Then (20.5–20.6)
- [x] 16. Nested transactions are not supported, alignment.md, and final verification (20.4, 21.1, 11.1–11.4, 11.6)
- [x] 17. The Node.js charge-racing-checkout test matches JVM and .NET (20.7)
