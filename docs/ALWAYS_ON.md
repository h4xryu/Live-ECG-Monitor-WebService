# 서버를 어디서든 접속 가능하게 + 항상 켜 두기

연구실 PC에서 돌리는 이 Next.js 서버(포트 3000)를 **외부(연구실 밖, LTE 등)에서도** 쓰고,
**재부팅해도 자동으로** 다시 켜지게 만드는 방법입니다. 공유기 포트 개방은 필요 없습니다.

```text
[Android 앱 / 브라우저] --HTTPS--> Cloudflare Tunnel --> 연구실 PC localhost:3000 (Next.js)
```

| 단계 | 하는 일 | 결과 |
|---|---|---|
| 0 | 서버 직접 실행 | 연구실 PC / 같은 Wi-Fi / USB(adb reverse)에서만 접속 |
| 1 | Quick Tunnel | 외부 접속 가능, **켤 때마다 주소가 바뀜** (테스트용) |
| 2 | 도메인 + Named Tunnel | 외부 접속 가능, **고정 주소** |
| 3 | systemd 자동 실행 | 재부팅·크래시 후에도 서버와 터널이 자동으로 다시 켜짐 |

---

## 0. 서버 직접 실행 (기본) — 새 PC에서도 동일

필요한 것: Node.js 18+ 와 pnpm (`npm install -g pnpm`). 연구실 PC에서는 `conda activate ecgweb`.

```bash
git clone https://github.com/h4xryu/Live-ECG-Monitor-WebService.git
cd Live-ECG-Monitor-WebService
./scripts/setup.sh     # pnpm install + .env.local(랜덤 JWT_SECRET) 생성 + pnpm build
pnpm start             # http://localhost:3000
```

이미 받아 둔 PC에서 최신 코드로 바꿀 때:

```bash
git pull
./scripts/setup.sh     # 기존 .env.local 은 건드리지 않음
pnpm start             # 서비스로 등록했다면: systemctl --user restart ecg-web
```

**git 에 올라가지 않는 것** (PC마다 따로 존재):
- `.env.local` — JWT 비밀키. PC마다 다르면 다른 PC에서 발급된 로그인 토큰은 무효.
- `data/` — 회원 계정(`users.json`)과 업로드된 ECG 기록. **새 PC는 빈 상태로 시작**하므로 회원가입부터 다시 해야 합니다. 옮기고 싶으면 `data/` 폴더를 직접 복사하세요.

### Android 앱 서버 주소 (앱 설정 화면)

주소는 반드시 **`/api/` 로 끝나야** 합니다.

| 상황 | 앱에 넣을 주소 |
|---|---|
| 에뮬레이터 | `http://10.0.2.2:3000/api/` (기본값) |
| 실제 폰 + USB | PC에서 `adb reverse tcp:3000 tcp:3000` 후 `http://localhost:3000/api/` |
| Quick Tunnel | `https://<랜덤>.trycloudflare.com/api/` |
| 고정 도메인 | `https://api.example.com/api/` |

- 앱은 평문 HTTP를 `10.0.2.2`, `localhost` 에만 허용합니다. 같은 Wi-Fi의 LAN IP(`http://192.168.x.x:3000`)는 앱 쪽 `network_security_config.xml` 에 추가하지 않으면 차단됩니다.
- `adb reverse` 는 USB를 뽑거나 폰을 재부팅하면 풀리므로 다시 실행해야 합니다.

---

## 1. Quick Tunnel (도메인 없이 바로 테스트)

서버가 켜진 상태에서 다른 터미널에서:

```bash
cloudflared tunnel --url http://localhost:3000
```

출력에 나오는 `https://<랜덤>.trycloudflare.com` 이 외부 주소입니다.

- 무료, 계정 불필요. 대신 **cloudflared 를 다시 켤 때마다 주소가 바뀌고**, 장시간 운영용이 아닙니다.
- Quick Tunnel 을 여러 개 띄우면 주소도 여러 개 생깁니다. 안 쓰는 건 꺼 두세요 (`pkill -f "cloudflared tunnel --url"`).

---

## 2. 고정 주소: 도메인 + Named Tunnel

준비물: Cloudflare 계정, Cloudflare 에 연결된 도메인 (Cloudflare Registrar 에서 사면 네임서버 변경 불필요).

```bash
cloudflared tunnel login                                  # 브라우저에서 도메인 선택
cloudflared tunnel create ecg-backend                     # Tunnel ID 와 ~/.cloudflared/<ID>.json 생성
cloudflared tunnel route dns ecg-backend api.example.com  # DNS 레코드 자동 생성
cp deploy/cloudflared-config.example.yml ~/.cloudflared/config.yml
nano ~/.cloudflared/config.yml                            # <TUNNEL_ID>, <USER>, hostname 수정
cloudflared tunnel run ecg-backend                        # 동작 확인 (Ctrl+C 로 종료)
```

확인: 다른 네트워크(폰 LTE 등)에서 `https://api.example.com/api/health` → `{"status":"ok",...}`

---

## 3. 재부팅 후에도 자동 실행 (systemd --user)

서버와 터널을 **사용자 서비스**로 등록합니다. 크래시하면 5초 뒤 재시작, 부팅하면 자동 시작.

```bash
conda activate ecgweb
cd /path/to/Live-ECG-Monitor-WebService
pnpm build
./scripts/install-always-on.sh
# 손으로 띄운 pnpm start / cloudflared 가 있으면 먼저 Ctrl+C 로 끈 뒤:
systemctl --user start ecg-web ecg-tunnel
loginctl enable-linger $USER    # 로그인 안 해도 부팅 시 시작
```

- `ecg-tunnel` 은 `~/.cloudflared/config.yml` (2단계) 이 있을 때만 설치됩니다.
- 스크립트는 지금 셸의 `node`/`pnpm` 경로를 서비스에 고정합니다. conda 환경을 바꾸면 스크립트를 다시 실행하세요.
- 코드를 고친 뒤에는: `pnpm build && systemctl --user restart ecg-web`

| 확인/관리 | 명령 |
|---|---|
| 상태 | `systemctl --user status ecg-web ecg-tunnel` |
| 로그 | `journalctl --user -u ecg-web -f` |
| 끄기 | `systemctl --user stop ecg-web ecg-tunnel` |
| 자동 실행 해제 | `systemctl --user disable ecg-web ecg-tunnel` |

### ⚠️ 저장소가 외장/보조 드라이브(`/run/media/...`)에 있는 경우

`/run/media/<user>/...` 드라이브는 **데스크톱에 로그인해야** 자동 마운트됩니다. 그 전에는
서비스가 파일을 못 찾아 5초마다 재시도만 합니다(로그인하면 그때 뜸). 로그인 없이 부팅만으로
켜지게 하려면 드라이브를 `/etc/fstab` 에 등록하세요:

```bash
lsblk -f                                   # 드라이브 UUID 확인
sudo mkdir -p /mnt/data
# /etc/fstab 에 한 줄 추가 (ext4 예시, UUID 는 실제 값으로):
# UUID=<드라이브-UUID>  /mnt/data  ext4  defaults,nofail  0  2
sudo mount -a
```

그 후 저장소를 `/mnt/data/...` 경로에서 열고 `install-always-on.sh` 를 다시 실행합니다.
(`nofail` 은 드라이브가 빠져 있어도 부팅이 멈추지 않게 합니다.)

### PC 자체 설정
- 절전/자동 잠자기 끄기 — PC가 자면 터널도 끊깁니다.
- BIOS 의 "AC Power Recovery / Restore on AC Power Loss" → On (정전 후 자동 부팅).

---

## 4. 외부에 열기 전에 — 보안 체크리스트

터널 주소는 **아는 사람 누구나** 접속할 수 있습니다. 상시 공개 전에는 아래를 먼저 해결하세요.

- [ ] `.env.local` 의 `JWT_SECRET` 이 예시값이 아닌 긴 랜덤 문자열인지 (없으면 코드의 기본 비밀값으로 토큰이 서명됨)
- [ ] **회원가입(`/api/auth/signup`)이 누구에게나 열려 있음** — 막거나 초대 코드 방식으로 바꾸기
- [ ] 로그인 시도 횟수 제한 없음 — Cloudflare 대시보드의 Rate limiting 규칙 등으로 제한
- [ ] 실제 피험자/환자 ECG 를 다룬다면 IRB·기관 규정 확인 (데이터는 이 PC의 `data/` 에 저장됨)
- [ ] 쓰지 않는 Quick Tunnel 은 꺼 두기

---

## 5. 문제 해결

| 증상 | 확인 |
|---|---|
| 외부 주소에서 502 / 1033 | 서버가 꺼짐 → `systemctl --user status ecg-web`, `curl localhost:3000/api/health` |
| 앱에서 404 | 서버 주소가 `/api/` 로 끝나는지 |
| 앱 로그인 실패 (실제 폰) | `10.0.2.2` 는 에뮬레이터 전용 — 위 표의 주소 사용 |
| Quick Tunnel 주소가 바뀜 | 정상 동작. 고정하려면 2단계 |
| 재부팅 후 안 켜짐 | `loginctl show-user $USER -p Linger` 가 `yes` 인지, 드라이브 마운트(위 ⚠️) |
| 실시간 화면이 "disconnected" | 서버 재시작 시 실시간 상태(메모리)는 초기화됨 — 앱이 다음 전송(약 2.5초)부터 다시 채움 |
