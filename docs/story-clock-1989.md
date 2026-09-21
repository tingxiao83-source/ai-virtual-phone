# Story clock

The phone displays 1989 while month, day, weekday and time follow the device's real calendar. This is a fictional calendar, not the historical Gregorian calendar of 1989. Leap days follow the real year. Calendar navigation uses real dates internally and fictional ISO labels for existing schedule storage.

Real timestamps remain unchanged for message order, elapsed time, notifications, authentication and persistence. Character time zones still use real DST rules; only their displayed year changes. The current displayed year stays 1989 after New Year.

Shopping catalog/search prompts receive era constraints even with saved custom templates. Xiaohongshu uses its existing era guard, now with the same device date and weekday. Existing posts, products, orders and messages are preserved; refreshing generates new era-constrained content. Model output remains probabilistic and should be reviewed if a historical detail matters.

Validation: `node scripts/test-story-clock.cjs`, `npx tsc --noEmit --incremental false`, `npm run build`.
