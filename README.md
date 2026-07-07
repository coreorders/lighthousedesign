# Light House Design 고객 소통 플랫폼

인테리어 현장별 일정, 사진, 공지, 한줄 메모를 고객에게 달력 형태로 공유하는 MVP입니다.

## 구성

- `frontend/`: GitHub Pages에 올릴 수 있는 순수 HTML/CSS/JavaScript 앱
- `backend/`: Node.js + Express API 서버
- `db/init.sql`: PostgreSQL 초기 스키마
- `docker-compose.yml`: API 서버와 PostgreSQL 실행 구성

## 주요 흐름

1. 관리자가 로그인합니다.
2. 관리자가 현장을 만들고 고객용 비밀번호를 설정합니다.
3. 관리자가 날짜별 일정과 사진을 등록합니다.
4. 고객은 `?site=현장URL이름`으로 접속하고 비밀번호를 입력합니다.
5. 고객은 달력, 사진, 공지, 메모를 확인하고 메모를 작성할 수 있습니다.

고객 메모는 작성만 가능하며 수정/삭제할 수 없습니다. 메모 삭제는 관리자 권한으로만 처리합니다.

## 로컬 실행

1. `.env.example`을 `.env`로 복사합니다.
2. `.env`의 비밀번호와 `JWT_SECRET`을 변경합니다.
3. Docker로 백엔드를 실행합니다.

```bash
docker compose up --build
```

API 서버는 기본적으로 `http://localhost:3000`에서 실행됩니다.

프론트엔드는 정적 파일이므로 개발 중에는 `frontend/index.html`을 열거나 간단한 정적 서버로 띄우면 됩니다.

```bash
cd frontend
python -m http.server 8080
```

그 다음 `http://localhost:8080`으로 접속합니다.

관리자 화면은 고객 첫 화면에 노출하지 않고 아래 주소로 직접 접속합니다.

```text
http://localhost:8080/#admin
```

운영 배포 후에는 아래처럼 경로 기반 주소를 사용합니다.

```text
https://lighthousedesign.cloud/현장URL이름
https://lighthousedesign.cloud/admin
```

GitHub Pages에서 `/현장URL이름` 같은 임의 경로가 앱으로 열리도록 `frontend/404.html`도 같은 앱 셸로 둡니다.

## 관리자 기본 계정

첫 실행 시 `.env`의 아래 값으로 관리자 계정이 자동 생성됩니다.

```env
ADMIN_ID=lhd
ADMIN_PASSWORD=change-this-admin-password
```

기존 `.env`에 `ADMIN_EMAIL=lhd`처럼 적어둔 경우도 계속 동작합니다. 새로 설정할 때는 `ADMIN_ID`를 권장합니다.

운영 전에 반드시 변경해야 합니다.

## 운영 메모

- 사진 업로드 용량은 애플리케이션 차원에서 제한하지 않습니다.
- 로컬 PC의 디스크 용량을 주기적으로 확인해야 합니다.
- 완료된 현장은 `완료` 상태로 둘 수 있고, 고객 접근 종료 또는 완전 삭제를 선택할 수 있습니다.
- GitHub Pages에서 실제 고객에게 보여주려면 API는 HTTPS 주소가 필요합니다. Cloudflare Tunnel을 붙이면 로컬 PC의 API를 안전하게 외부 HTTPS 주소로 노출할 수 있습니다.

## GitHub Pages 배포 구조

프론트엔드는 GitHub Pages에 올리고, 데이터와 사진은 내 컴퓨터의 Docker API/DB를 사용합니다.

```text
https://lighthousedesign.cloud/현장URL이름
  -> GitHub Pages 정적 프론트
  -> https://api.lighthousedesign.cloud API 호출
  -> 내 컴퓨터 Docker API
  -> 내 컴퓨터 Docker PostgreSQL
```

관리자 화면은 아래 주소로 접근합니다.

```text
https://lighthousedesign.cloud/admin
```

GitHub Pages 설정:

1. GitHub 저장소 Settings > Pages로 이동합니다.
2. Source를 GitHub Actions로 설정합니다.
3. Custom domain에 `lighthousedesign.cloud`를 입력합니다.
4. HTTPS가 가능해지면 Enforce HTTPS를 켭니다.

DNS 설정:

`lighthousedesign.cloud` 루트 도메인은 GitHub Pages로 연결합니다.

```text
A  @  185.199.108.153
A  @  185.199.109.153
A  @  185.199.110.153
A  @  185.199.111.153
```

API 주소는 Cloudflare Tunnel에서 `api.lighthousedesign.cloud`를 Docker Compose 내부의 `http://api:3000`으로 연결합니다.

프론트의 API 주소는 [frontend/config.js](frontend/config.js)에 있습니다.

## Cloudflare Tunnel 설정

Cloudflare Tunnel로 `api.lighthousedesign.cloud`를 내 컴퓨터 Docker API에 연결합니다.

가장 쉬운 방식은 `lighthousedesign.cloud` 도메인의 네임서버를 Cloudflare로 옮긴 뒤, Cloudflare DNS에서 GitHub Pages 레코드와 API 터널 레코드를 같이 관리하는 것입니다.

Cloudflare DNS에 GitHub Pages 레코드를 다시 추가합니다.

```text
A      @     185.199.108.153
A      @     185.199.109.153
A      @     185.199.110.153
A      @     185.199.111.153
CNAME  www   coreorders.github.io
```

Cloudflare Zero Trust에서 Tunnel을 만듭니다.

1. Zero Trust > Networks > Tunnels로 이동합니다.
2. 새 tunnel을 만들고 Connector는 Docker를 선택합니다.
3. 발급된 token을 `.env`의 `CLOUDFLARE_TUNNEL_TOKEN`에 붙여 넣습니다.
4. Public Hostname을 추가합니다.

```text
Hostname: api.lighthousedesign.cloud
Service:  http://api:3000
```

터널까지 함께 실행합니다.

```bash
docker compose --profile tunnel up --build
```

API 연결 확인:

```text
https://api.lighthousedesign.cloud/api/health
```

정상이라면 아래 응답이 나옵니다.

```json
{"ok":true}
```

## API 주소 변경

프론트는 기본적으로 `http://localhost:3000` API를 사용합니다. 배포 후에는 브라우저 콘솔에서 아래처럼 API 주소를 저장할 수 있습니다.

```js
localStorage.setItem("lhdApiBase", "https://api.example.com");
```

이후 페이지를 새로고침하면 해당 API 주소를 사용합니다.
