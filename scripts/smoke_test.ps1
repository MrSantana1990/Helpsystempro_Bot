param(
  [string]$ApiBase = "http://127.0.0.1:8502"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Ok($label, $value) {
  Write-Host ("[OK]  " + $label + " -> " + $value) -ForegroundColor Green
}

function Fail($label, $err) {
  Write-Host ("[FAIL] " + $label + " -> " + $err) -ForegroundColor Red
  throw $err
}

function GetJson($url) {
  $r = Invoke-WebRequest -UseBasicParsing $url -TimeoutSec 10
  return ($r.Content | ConvertFrom-Json)
}

function PostJson($url, $obj) {
  $body = ($obj | ConvertTo-Json -Depth 10)
  $r = Invoke-WebRequest -UseBasicParsing $url -Method Post -ContentType "application/json" -Body $body -TimeoutSec 10
  return ($r.Content | ConvertFrom-Json)
}

Write-Host "Smoke test API: $ApiBase" -ForegroundColor Cyan

try {
  $health = GetJson "$ApiBase/api/health"
  if ($health.ok -ne $true) { Fail "health" "ok!=true" }
  Ok "health" "ok=true"

  $ov = GetJson "$ApiBase/api/overview"
  Ok "overview" ("testnet=" + $ov.testnet + " decisions=" + $ov.counts.decisions + " trades=" + $ov.counts.trades)

  $fx = GetJson "$ApiBase/api/market/usdtbrl"
  Ok "usdtbrl" ("price=" + $fx.price)

  $reg = GetJson "$ApiBase/api/symbols/registry"
  Ok "symbols.registry" ("auto=" + ($reg.auto_symbols | Measure-Object).Count + " pending=" + ($reg.pending | Measure-Object).Count)

  $tick = GetJson "$ApiBase/api/market/tickers?symbols=BTCUSDT,ETHUSDT"
  Ok "tickers" ("rows=" + ($tick.rows | Measure-Object).Count)

  $kl = GetJson "$ApiBase/api/market/klines?symbol=BTCUSDT&interval=15m&limit=20"
  Ok "klines" ("closes=" + ($kl.closes | Measure-Object).Count)

  $top = PostJson "$ApiBase/api/bot/recommend_topup" @{ current_brl = 50; current_usdt = 0 }
  Ok "topup" ("suggestion_brl=" + $top.suggestion_brl)

  $cfg = GetJson "$ApiBase/api/config/status"
  Ok "config.status" ("write_enabled=" + $cfg.write_enabled)
} catch {
  Fail "smoke" $_.Exception.Message
}

Write-Host "Tudo OK." -ForegroundColor Green
