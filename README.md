# Pomodoro

シンプルなポモドーロタイマーです。

## Development

```bash
npm install
npm run dev
```

## GTM / GA4
実際のコンテナIDに差し替えると、アプリは `dataLayer` に以下のイベントを送ります。

- `page_view`
- `pomodoro_timer_toggle`
- `pomodoro_timer_reset`
- `pomodoro_session_complete`
- `pomodoro_session_skip`
- `pomodoro_mode_switch`
- `pomodoro_duration_change`
- `pomodoro_settings_toggle`
- `pomodoro_audio_toggle`
- `pomodoro_menu_visibility_toggle`

GA4 への送信は GTM 側で設定してください。

1. GTM で `Google タグ` または `GA4 Configuration` タグを作成
2. GA4 の測定IDを設定
3. `All Pages` と必要なカスタムイベントで発火

`pomodoro_*` 系のイベントは GTM のカスタムイベントトリガーで GA4 Event タグへ転送できます。
