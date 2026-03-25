# [PRD] 허브 AIT 생성 기능 추가

> **JIRA**: OVDR-9591 ~ OVDR-9670  
> **Status**: 기획 DONE, 디자인 DONE, FE/BE/Unreal/QA WAITING~BACKLOG

---

## 담당자

| 역할 | 담당 |
|------|------|
| PO | @Jaeni Lee (이재니) |
| 디자인 | @Namkyung Oh (오남경) |
| FE | @Jonghyuk Lee (이종혁) |
| BE | @Uhyun Park (박의현) |
| Unreal | @Seokyoung Jeong (정석영) |
| QA | @Mincheol Choi (최민철) |

---

## 기획 의도

- **목표**: Avatar Item 1건의 제작~판매 E2E 소요 시간을 평균 60분 → **5분 이하**로 단축
- 자연어 프롬프트 입력 후 **15초~40초 이내**에 UV 텍스처 1개 생성
- UGC 마켓플레이스 성립을 위해 아이템 대량 공급이 전제 → 현재 UV 템플릿 직접 작업 방식이 병목
- 크리에이터가 **자연어 프롬프트 하나만으로** 코스튬 텍스처를 생성하고 판매할 수 있게 함

---

## Key Features

| No. | 제목 | 내용 | 우선순위 |
|-----|------|------|----------|
| 1 | 인지 | 신규 AIT 5종을 이미지 업로드/AI 생성 방식으로 제작 가능함을 인지 | P0 |
| 2 | 이미지 업로드 | 신규 AIT 5종을 이미지 업로드 방식으로 제작 | P0 |
| 3 | AI 생성 | 신규 AIT 5종의 텍스처를 자연어 프롬프트만으로 생성 | P0 |
| 4 | 생성 진행 | 생성 진행 여부 인지, 생성 중 중복 생성 불가 | P0 |
| 5 | 생성 결과 확인 | 결과 확인 후 디자인 확정 또는 프롬프트 수정 후 재생성 | P0 |
| 6 | 판매 | AI로 만든 텍스처 적용 코스튬을 기존과 동일하게 마켓플레이스에서 판매 | P0 |
| 7 | 관리 | AI로 만든 코스튬 관리 | P0 |
| 8 | TBD 에디터 | 생성된 이미지 편집 기능 | P1 |
| 9 | TBD AI 생성 과금 | 생성 횟수 소진 시 추가 생성권을 BLUC으로 구매 | P1 |

---

## 상세 스펙

### 1. [구 템플릿 제거] 신규 AIT 5종 외 제거
- 신규 AIT 5종 외 나머지 (구) 템플릿 전체 Hub에서 hide
- (구) 템플릿으로 이미 제작되어 판매 중인 아이템은 유지 (제작만 금지)
- Hub > My Contents: (구) 템플릿 아이템은 그대로 노출, 판매 유지, 추가 제작 불가
- App > Marketplace: (구) 템플릿 아이템은 기존과 동일하게 판매 유지

### 2. [인지] AI 생성 옵션 인지
- 신규 AIT 5종 클릭 시 제작 방식 선택 UI 표시
  - **AI Generate**: 신규 AI 텍스처 생성 방식
  - **Upload Image**: 기존 수작업 업로드 (현행 유지)
- UV 템플릿 다운로드 기능 동일 지원, 사이즈 규격 동일
- **AI 생성 가능 파츠 (MVP 5종)**: Head, Tshirt, Pants, Gloves, Boots

### 3. [이미지 업로드] 수작업 방식 제작
- 기존 제작 방식 100% 유지
- 좌측 3D 프리뷰 + 우측 UV 템플릿 이미지 + 예제 이미지 다운로드

### 4. [AI 생성] 프롬프트 기반 텍스처 생성
- **프롬프트 입력 영역**:
  - Placeholder: "Describe the style you want (e.g., 'Red and black ninja outfit with gold trim')"
  - 최대 글자수: 500자
  - 디스크립션: "Describe your avatar item. Add colors, materials, and details for better results."
- **Style References**: 파츠별 예시 프리셋 3개 노출
  - 프리셋 클릭 시 예제 프롬프트 자동 입력 + 3D 프리뷰에 예제 텍스처 적용
- **Generate 버튼**: 클릭 시 AI 생성 요청 → 즉시 생성횟수 차감
- **생성 정책**:
  - 1회당 1장 생성
  - 생성 가능 횟수: 5회 (매일 UTC 0시 최대 5회까지 충전, 잔여분 이월)
  - 내부 담당자가 어드민에서 횟수 조정 가능
- **생성 프로세스**: Generate 클릭 → ComfyUI 엔드포인트 요청 → 로딩 → S3 저장 → 허브에서 불러오기
- **에러 처리**:
  - 생성 실패 시 횟수 미차감
  - 실패: "Generation failed. Please try again." + Retry 버튼
  - 타임아웃: "Taking longer than expected. Please try again."
- **페이지 벗어남 정책**: "Leaving this page or refreshing will cancel the generation. Your trial will still be used, and the result will be lost."

### 5. [생성 진행] AI 생성 로딩 대기
- 생성 시 횟수 실시간 차감 표시
- 언리얼 뷰 위에 로딩 상태 표시
- 디스크립션: "Generating the image may take up to 1 minute."
- **생성 중 금지 액션**: 프롬프트 수정/재생성, Style References 클릭

### 6. [생성 결과 확인]
- 좌측 3D 프리뷰에 생성된 이미지 메시 파츠 적용
- 프롬프트는 그대로 유지 → 수정 후 재생성 가능
- 생성횟수 소진 시 Generate 버튼 disable
- **이전 결과물 확인**: Your Results 영역 화살표로 이전 결과물 확인 가능
- **두 번째 생성 결과물 툴팁**: "You can go back to your previous design."
- Next: 현재 텍스처 확정 → Step 3 진행
- Back: 페이지 벗어남

### 7. [판매] 텍스처 확정 및 다음 단계
- Next 클릭 시 텍스처 확정
- Step 3: Name, Category, Sale (On/Off), Price (BLUC, min 50), Tag (최대 5개) — 기존 100% 동일
- Step 4 (Complete), 심사 프로세스도 기존 동일

### 8. [관리]
- **경로**: My Contents > AI 생성 코스튬 클릭
- AI 아이템 메타데이터 수정 시 도안 수정 불가 (template 탭 제거로 대응)
- AI 생성 아이템 도안 썸네일에 AI 아이콘 표시

### 9. [BM] AI 생성 과금 정책 (TBD)
- 기본 생성권: 5회 (초기값)
- Dev, Staging 환경: 무제한 사용 가능
- 추가 생성권: 1,000 Earned BLUC = 5회
- 생성권 0인 상태에서 생성 시 구매 유도 팝업 노출
- BLUC 잔액 부족 시 구매 불가 안내
- 수치(횟수/가격)는 운영 파라미터로 조정 가능하게 설계

---

## Example Styles 파츠별 프롬프트

| Part | Anime High School | KPOP Star | Gyaru |
|------|-------------------|-----------|-------|
| Head | Soft anime-style high school student look. Natural black hair, slightly layered cut, clean shading, subtle highlights, youthful and neat appearance. Smooth cel-shaded texture, bright and fresh tone. | Trendy idol hairstyle with soft ash brown color, glossy shine, slightly tousled styling. Clean gradient shading, stage-ready polished texture, high detail hair strands. | Voluminous light brown hair with heavy curls and bangs. Strong highlights, glossy shine, bold shading contrast, flashy and dramatic anime texture style. |
| Tshirt | Japanese high school uniform top. Clean white shirt with navy collar detail, minimal wrinkles, soft cel-shading, simple and neat anime texture. | Stylish cropped stage outfit top. Black base with metallic accents, subtle fabric shine, sharp contrast shading, performance-ready idol costume texture. | Flashy fitted top with leopard pattern and pink accents. Glossy fabric look, strong highlights, bold contrast shading, trendy gyaru fashion vibe. |
| Pants | Classic navy school uniform slacks. Simple fabric texture, soft folds, minimal shading, clean anime-style textile surface. | Slim-fit black performance pants with subtle leather texture. Light reflection on edges, sharp creases, stage lighting effect shading. | Low-rise denim with heavy wash texture, visible stitching, slightly distressed details, bold shading and high contrast highlights. |
| Gloves | Simple dark school gloves. Matte fabric texture, soft shading, minimal detail, clean anime cel style. | Black fingerless performance gloves with subtle leather shine. Defined seam details, stage-ready texture finish. | Bright pink glossy gloves with decorative patterns. Shiny material texture, strong highlights, flashy fashion styling. |
| Boots | Clean black school loafers. Smooth leather texture, subtle shine, minimal crease detail, soft anime shading. | High black stage boots with metallic accents. Glossy leather texture, strong light reflection, sharp contrast for stage presence. | Platform boots with bold color accents and decorative straps. Glossy finish, exaggerated shine, strong contrast shading. |
