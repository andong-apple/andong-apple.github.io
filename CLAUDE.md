# 사과주문앱

판매자(지인)가 모바일에서 상품·재고·계좌·주문을 관리하는 사과 주문 페이지.

## 구조
- `docs/index.html` — 화면 전체(구매자 + 판매자 모드). GitHub Pages로 서비스: https://andong-apple.github.io
  (저장소 andong-apple/andong-apple.github.io, main 브랜치 /docs)
- `gas/Code.js` — 구글 시트에 연결된 Apps Script. `doPost`로 JSON 요청을 받아 `API` 객체에 등록된 함수만 실행.
  `doGet`은 예전 /exec 링크로 온 사람을 새 주소로 안내만 함.
- `원본_기관계정/` — 기관 계정(admin@gndcsenior.org)에서 가져온 최초 원본. 수정하지 않음.

## 계정
- 소유 계정: bachtearvibe@gmail.com (시트·스크립트). 기관 계정은 쓰지 않음.
- Script ID: 1JhUXpe_iHXWsfqX_5rzZD4boOUEyPagG4JLbN4rIX3yYj1qCFuqP50Yn
- 배포 ID(주소 고정): AKfycbxkK0MdcI7WfoLM6kD601azygIwlVaNBXRgf_iEAjL8p-KUXJfKEVXRA38O3l1WpwY

## 배포 방법
- 화면 수정: `git push` → 1~2분 후 GitHub Pages 반영.
- 서버 수정 (주소 유지를 위해 반드시 같은 배포 ID를 업데이트, 새 배포 만들지 말 것):
  ```
  cd gas
  clasp push --force --user vibe
  clasp update-deployment AKfycbxkK0MdcI7WfoLM6kD601azygIwlVaNBXRgf_iEAjL8p-KUXJfKEVXRA38O3l1WpwY --user vibe
  ```
- 서버 함수를 새로 만들면 `API` 객체에 등록해야 화면에서 호출 가능.
- 서버 버전 표시는 `Code.js`의 `VER`. 배포 후 getPublic 응답의 `ver`로 반영 여부 확인
  (clasp push가 시간 초과로 끊겨도 다음 명령이 실행될 수 있으니 "Pushed" 출력을 꼭 확인).
- 서버와 화면을 같이 바꿀 때는 서버 먼저 배포하고, 서버는 예전 화면 요청도 받도록 호환 유지.
- 주문 시트 열(HEAD) 순서를 바꿀 때는 ensureHeader_에서 기존 시트 열을 moveColumns로 옮기는 처리를 함께 넣을 것.
  화면은 열 이름으로 찾음(`docs/index.html`의 `COLS`가 표·엑셀 표시 순서).

## 주의
- 판매자 비밀번호는 스크립트 속성(PW, 해시)에 저장. 잊으면 편집기에서 `resetPassword` 실행 → 1234.
- 저장소는 공개. 계좌·고객정보·비밀번호는 코드에 넣지 말 것(시트/스크립트 속성에만).

## 택배 엑셀
- 판매자 주문내역의 "택배 엑셀" = `docs/lotte-template.xlsx`(롯데택배 양식, 원본은 루트의 `롯데택배명단 양식.xlsx`)에 값만 채워 내려받기. ExcelJS 사용(서식 보존).
- 받는 곳 한 줄당 한 행. 상품명·보내는사람(입금자)·연락처는 주문 맨 윗줄 값을 이어받음.
- 보내는 사람 주소는 `docs/index.html`의 `SENDER_ADDR` 상수.
