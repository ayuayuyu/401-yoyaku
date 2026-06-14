- [x] Review current mobile layout pain points
- [x] Remove custom date navigation
- [x] Place new reservation button inside calendar
- [x] Adjust calendar container spacing and typography for mobile

## Review
- [ ] Verify calendar usability on mobile widths
- [ ] Confirm week/day views remain scrollable to 22:00

## Fix: 予約が初回/作成直後に表示されない (2026-06-14)
- [x] 真因特定: Schedule-X 4.x の onRangeUpdate は初回 range セット時に発火しない(wasInitialized)。初回ロードが空になり rangeRef も未設定で refreshKey リフェッチも走らない
- [x] range ベース読み込みを callbacks.fetchEvents に一本化(初回レンダーでも発火する正規API)
- [x] mutation 後の手動リフェッチは eventsService.set で継続(rangeRef は fetchEvents が埋める)
- [x] 二次対応: customComponents を useMemo で安定化 / plugins から number(nEventsPerDay) 除去
- [x] tsc / lint / コンテナ再コンパイルで検証
