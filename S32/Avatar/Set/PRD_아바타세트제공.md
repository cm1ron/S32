# [PRD] 아바타 세트 제공

> **QA 대상**: S32 | **배포**: 추후 예정  
> **JIRA**: OVDR-896x  
> **Status**: Server/Android IN PROGRESS, QA BACKLOG

---

## 담당자

| 역할 | 담당 |
|------|------|
| PO | @Jaeni Lee (이재니) |
| 디자인 | @Changmo Kang (강창모) |
| Server | @Kwonsoo Park (박권수) |
| Android | @Hyunchul Jo (조현철) |
| QA | @Mincheol Choi (최민철), @Jaeni Lee (이재니) |

---

## 기획 의도

- UGC 확장으로 아이템 수 증가 → 브라우징 불편
- 완성된 스타일 단위로 탐색할 수 있는 **세트 상품** 필요
- 기존 아바타 쇼케이스 기능과 중복 없이 시너지 낼 수 있는 확장 구조 설계
- 마켓플레이스 최상단에 아바타 세트 우선 노출

---

## 개념 및 정의

### 아바타 세트란?
- 마켓플레이스 내 **헤드/바디 + 외형 파츠 3개 이상**을 하나의 스타일로 묶어 보여주는 큐레이션 단위 (애니메이션/이모트 제외)
- 세트는 독립된 상품이 아님 → 구매 시 포함된 **개별 아이템을 묶음 구매**
- 각 아이템은 유저 인벤토리에 개별 귀속

### 세트 구성 기조
- 헤드/바디 + 외형 파츠 3개 이상
- 외형 파츠 최소 3개는 마켓플레이스 판매 중인 아이템 기준
- 비매품 아이템(가챠, 구템)은 세트 코디 화면에는 보이지만 구매 목록에는 미포함
- 동일 아이템이 여러 세트에 중복 포함 가능

### 세트 등록
- 아바타 쇼케이스에 게시된 코디 중 조건 충족 시 → 마켓플레이스 Avatars 탭에 **자동 등록**
- 세트는 Account와 별도 엔티티로 관리, 생성 유저의 Account ID 참조 연결

### 계정 상태별 대응
- 큐레이터 탈퇴 → 세트 비노출
- 큐레이터 Ban → 세트 비노출
- 코스튬 1개라도 Ban / 마켓에서 내려감 → 세트 비노출

---

## Key Features

| 단계 | 구분 | 내용 | 우선순위 |
|------|------|------|----------|
| 1 | 발견 | 마켓플레이스에서 아바타 세트 탐색 | P0 |
| 2 | 장착 | 마켓플레이스에서 아바타 세트 장착 | P0 |
| 3 | 구매 | 마켓플레이스에서 아바타 세트 구매 | P0 |
| 4 | 세트 게시 | Web 쇼케이스에 코디 게시 → 아바타 세트로 등록 가능 안내 | P0 |
| 5 | 세트 등록 알림 | 코디가 아바타 세트로 등록 시 유저에게 알림 발송 | P1 |
| 6 | 운영 관리 | Hiker에서 세트 노출 기준 관리, 수동 상단 노출(끌올) | P0 |

---

## 상세 스펙

### 1. [발견] 아바타 세트 노출
- **경로**: Marketplace > Avatars 탭 (new)
- 마켓플레이스 카테고리 진입 시 최상단(좌측)에 'Avatars' 탭 고정 노출
- **그리드**: 1줄 3슬롯 / 마네킹 형식
- **최소 탐색 깊이**: 20줄
- **목표 세트 수**: 최소 80세트 (25~30줄 x 3슬롯)
- 세트 클릭 시 구성 아이템 상세 확인 가능
- **Figma**: [아바타 세트 노출](figma/01_아바타세트노출.png)

#### UX Spec: 재화 영역
- BLUC과 Gold가 둘 다 들어가는 경우 BLUC을 좌측에 우선 배치
- 재화 영역이 1줄을 넘어갈 경우 해당영역 2줄처리

### 2. [장착] 아바타 세트 프리뷰
- **경로**: Marketplace > Avatars 탭 > 개별 세트 클릭
- 세트 클릭 → 기존 장착 중인 아이템 슬롯 비워지고, 세트 파츠만 일괄 착용 (컬러 포함)
- 세트 착용 상태에서 뒤로가기 → 세트 해제, 이전 착용 상태로 원상복구
- 세트 착용 상태에서 다른 아이템 착용 → 세트 유지한 채 해당 슬롯만 추가/변경
- **Figma**: [세트 정보 확인](figma/02_세트정보확인.png)

#### UX Spec: 세트 정보 확인
- **Detail 영역 노출 순서** (탭 순서에 맞춰 우선순위가 높은 것 부터):
  - Body > Head > Hair > Tops > Bottoms > Outfit > Shoes > Headwear > Face > Hand > Back
- **이미 보유한 아이템**: 리스트 영역 좌상단 **Owned 뱃지** 노출

### 3. [구매] 아바타 세트 구매
- **경로**: Marketplace > Avatars 탭 > 개별 세트 클릭 > [Save] 클릭
- **전체 미보유**: 모든 파츠 구매 목록에 포함 → [Save] 버튼 활성화
- **일부 보유**: 미보유 파츠만 구매 목록에 포함 → [Save] 버튼 활성화
- **전체 보유**: [Save] 버튼 활성화되나 단순 룩 저장 (구매 X)
- **구매 후 귀속**: 세트 단위가 아닌 개별 파츠별로 Customize 카테고리 탭에 귀속
- **Figma**: [세트 구매](figma/03_세트구매.png)

#### UX Spec: 세트 구매
- 세트아이템 중 이미 보유한 아이템이 있는 경우 → 해당 아이템 Buy 영역에 **미노출**

### 4. [구매 내역] 아바타 세트 구매 내역
- **경로**: Item Purchases
- 세트 구매 시 Item Purchases에 묶음 구매 내역 기록
- Order Details에서 구성 아이템 메타데이터 확인 가능
- **Figma**: [구매 내역](figma/04_구매내역.png)

#### UX Spec: 구매 내역
- Detail 페이지 내, 개별 파츠 리스트 노출

### 5. [세트 게시] 아바타 쇼케이스 게시
- App 내 아바타 쇼케이스 게시 진입점에 안내 문구 노출
- **서브 타이틀**: "Your look may be featured as an Avatar Set in the Marketplace!"
- **인포 디테일**:
  - Set item revenue goes to individual creators
  - At least 3 costumes are required for review
  - Avatars may be featured based on internal criteria
  - Sets may be removed if an included costume is suspended
- **Figma**: [업로드 flow](figma/05_업로드flow.png), [Info 버튼](figma/06_info버튼.png)

### 6. [세트 등록 알림] 노티피케이션
- 큐레이터에게 '이번주에 내 세트가 올라갔어요' 노티 발송
- **노티 문구**: "My avatar set went up on the Marketplace this week."
- **트리거**: Avatars 탭에 내 세트 등록 직후
- **휘발 시점**: 클릭 즉시 휘발 / 30일 경과 시 휘발
- **Figma**: [노티피케이션](figma/07_노티피케이션.png), [노티 진입 경로](figma/08_노티진입경로.png)

#### UX Spec: 노티 진입 경로
- Notification Go 버튼 클릭 시, 아바타 탭 내 해당 아바타가 Actived, 앵커링 된 상태로 노출
- 업로드 이후 선별 시: 유저가 업로드한 아바타가 마켓플레이스에 올라간 경우 썸네일 이미지와 함께 Noti 메시지 전달

### 7. [운영 관리] Hiker
- **경로**: Hiker > Avatar Tab (new)
- Avatars 탭에 등록할 세트 리스트 관리
- **등록 조건**: 바디 + 코스튬 파츠 3개 이상 (마켓플레이스 판매 중인 아이템만)
- **화면 구성**: Username (큐레이터) + 마네킹 이미지 노출
- **수동 끌올 (Pin)**: 상단 9슬롯(3줄) 운영팀 수동 지정 가능
- **수동 제외**: 부적절한 세트 X 처리
- **SAVE**: 작업 항목을 Avatars 탭에 반영

---

## L10N 키

| # | Key | EN | PT | ES | HI |
|---|-----|----|----|----|-----|
| 1 | APP_STO_STORE_CATEGORY_AVATARS | Avatars | Avatares | Avatares | अवतार |
| 2 | APP_STO_STORE_ITEM_CURATOR_TEXT | Curator | Curador | Curador | क्यूरेटर |
| 3 | APP_STO_STORE_ITEM_OWNED_TEXT | Owned | Seu | Tuyo | मेरा |
| 4 | APP_CMN_SHARE_OVDRWEBSITE_DESC | Your look may be featured as an Avatar Set in the Marketplace! | Seu visual pode virar um Avatar Set no Marketplace! | ¡Tu look podría aparecer como Avatar Set en el Marketplace! | आपका लुक Marketplace में Avatar Set बनकर फीचर हो सकता है! |
| 5 | APP_CMN_SHARE_OVDRWEBSITE_INFO_DESC_1 | Set item revenue goes to individual creators | A renda do set vai direto pro criador | Las ganancias del set van directo al creador | सेट की कमाई सीधे क्रिएटर को जाती है |
| 6 | APP_CMN_SHARE_OVDRWEBSITE_INFO_DESC_2 | At least 3 costumes are required for review | Pelo menos 3 trajes pra entrar em análise | Se requieren al menos 3 atuendos para revisión | रिव्यू के लिए कम से कम 3 कॉस्ट्यूम चाहिए |
| 7 | APP_CMN_SHARE_OVDRWEBSITE_INFO_DESC_3 | Avatars may be featured based on internal criteria | Avatares podem ser destacados com base em critérios internos | Los avatares pueden destacarse según criterios internos | अवतार आंतरिक मानदंडों के आधार पर फीचर हो सकते हैं |
| 8 | APP_CMN_SHARE_OVDRWEBSITE_INFO_DESC_4 | Sets may be removed if an included costume is suspended | O set pode ser removido se algum traje for suspenso | El set puede eliminarse si algún atuendo es suspendido | अगर कोई कॉस्ट्यूम सस्पेंड हुआ, तो सेट हटाया जा सकता है |
| 9 | APP_SYS_NOTIFICATION_NOTITAB_MSG_MY_AVATARS_BTN | Go | Bora | Vamos | चलो |
| 10 | APP_NOTI_MY_AVATARS_STO | My avatar set went up on the Marketplace this week. | Meu avatar set acabou de chegar no Marketplace essa semana! | ¡Mi avatar set salió en el Marketplace esta semana! | मेरा Avatar Set इस हफ्ते Marketplace में लाइव हो गया! |

---

## TBD

### TBD-1. 블럭 접근성 개선
- 블럭만으로 판매 시 전환율 낮을 수 있음 → 블럭 접근성 높이는 방식
- 전체 아이템에 해당 정책 도입하여 모델 검증, A/B 테스트 고려

| 아이디어 | 설명 |
|----------|------|
| 하루 체험권 | 아이템 24시간 무료 착용 → 체험 후 구매 유도 |
| 대기 시 무료 획득 | 예약 후 7일 대기 → 무료 획득 (알림 ON 유도) |
| 교환권 | 이벤트/미션 보상으로 아이템 교환권 제공 |
| 코인 결제 | 블럭 외 무료 착용권은 코인으로 구매 가능? |

### TBD-2. 크리에이터 배포 세트의 아이템 삭제/비활성화 처리

| 상황 | 처리 방안 |
|------|-----------|
| 세트 내 아이템 삭제/비활성화 | 해당 세트 자동 비노출 처리 |
| 크리에이터 알림 | 세트 내려간 사유 알럿/푸시 통지 |
| 크리에이터 조치 | 아이템 대체/제거 후 세트 재등록 → 재심사 |
| 리젝 케이스 | 등록 시점에 구성 아이템이 이미 비활성이면 등록 리젝 |
