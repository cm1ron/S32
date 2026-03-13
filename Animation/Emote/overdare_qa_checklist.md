# 🎮 Animation / Emote 신규 피쳐 QA 체크리스트
> JIRA: `OVDR-8656` | PRD: `OVDR-8651`
> 빌드: `com.overdare.overdare.dev`
> 에셋 목록: [overdare_assets.md](./overdare_assets.md) | 버그 목록: [overdare_bug_list.md](./overdare_bug_list.md) | 테스트 시나리오: [overdare_test_scenarios.md](./overdare_test_scenarios.md)

---

## 🙋 DRI

| 역할                           | 담당자                    |
| ------------------------------ | ------------------------- |
| 기획 / QA                      | @Jaeni Lee (이재니)       |
| QA                             | @Mincheol Choi (최민철)   |
| Android                        | @Hyunchul Jo (조현철)     |
| Server                         | @Sanghyun Kim (김상현)    |
| Unreal (마켓 / 커마)           | @Seokyoung Jeong (정석영) |
| Unreal (휴머노이드 디스크립션) | @Hyunwook Yoo (유현욱)    |

---

## 📋 QA 전 준비 체크리스트

### 1. 빌드 & 환경

- [ ] 개발 빌드(`com.overdare.overdare.dev`) 최신 브랜치 설치 완료
- [ ] ADB 연결 확인 → `adb devices`
- [ ] logcat 모니터링 터미널 준비 (아래 명령어 참고)
- [ ] 화면 녹화 준비 (버그 발생 시 즉시 캡처)

### 2. 테스트 계정

- [ ] **계정 A (미구매)** — 탐색·구매 전 UI·버튼 상태 검증용
- [ ] **계정 B (구매 완료)** — 장착·해제·인게임 사용 검증용
- [ ] 계정 A BLUC 충전 확인 → 최소 **700 Bluc** 필요

| 아이템                           | 가격         |
| -------------------------------- | ------------ |
| Zombie Pack (bundle_anim:48)     | 150 Bluc     |
| Skate Pack  (bundle_anim:49)     | 100 Bluc     |
| Emote - Meditation (emote:76899) | 100 Bluc     |
| Emote - Rejection  (emote:76999) | 150 Bluc     |
| Emote - Salute     (emote:77099) | 200 Bluc     |
| **합계**                         | **700 Bluc** |

> ⚠️ Figma Spec에는 모든 번들/이모트가 **270** 표기 — 가격 불일치 기획 확인 필요 ([상세](./overdare_bug_list.md#2-가격-불일치))

### 3. QA 전 반드시 확인할 이슈

- [ ] **🚨 BUG-01 기획 의도 확인** → `bundle_anim:48` 번들 이름이 앱에서 "Zombie Animations Pack"으로 노출되나, Figma Spec은 **Ninja Animation Pack**
  - 닌자 맞으면 → 서버 데이터 수정 후 QA 진행 (@김상현)
  - 좀비 맞으면 → Spec 업데이트 요청 (@이재니)
- [ ] **🚨 BUG-02 확인** → Marketplace → Customize 전환 시 애니메이션 상태 불일치 (UE 재생 / UI / 번들 선택 3-way)
- [ ] **Stylish 번들 확인** → Figma에 "Stylish Animation Pack" (270) 존재, 개발 빌드에 미노출 — 미구현 or Default 이름 변경?
- [ ] **목업 vs 앱 불일치 확인** → 목업에 `Climb` / `Swim` 애니메이션이 있으나 앱에 미노출

### 4. logcat 모니터링 명령어

```bash
# 전체 애니/이모트 모니터링
adb logcat | grep -E "OVDR_grpc|OVDR_CustomizeViewModel|A2U_EQUIP|A2U_CANCEL|A2U_STOP|LogStreamingPak|ListCreatorProducts|GetDefaultAnimations"

# 에셋 다운로드 & 마운트 확인
adb logcat | grep -E "LogStreamingPak|LogIoDispatcher|LogPakFile"

# gRPC 오류 감지
adb logcat | grep -E "OVDR_grpc.*ERROR|status.*code=[^O]"
```

---

## 🗺️ 기능 동작 흐름

```
[커스터마이즈 진입]
  └─ AvatarAPI/GetDefaultAnimations       → 기본 애니 6종 로드
  └─ A2U_EQUIP_ANIMATION_ITEM (UE)        → 기본 애니 캐릭터 장착

[Animations 탭]
  └─ EquipableItemAPI/ListEquipableItems  → 보유 아이템 조회

[Marketplace 탭]
  └─ StoreAPI/ListCreatorProducts         → 마켓 상품 로드
  └─ EquipableItemAPI/HasEquipableItems   → 구매 여부 → 버튼 상태 결정

[Emote 탭 클릭]
  └─ A2U_STOP_ANIMATION_ITEM (UE)         → 애니 정지
  └─ StoreAPI/ListCreatorProducts (Emote) → 이모트 목록 로드

[아이템 선택]
  └─ A2U_EQUIP_ANIMATION_ITEM (UE)        → 장착 명령
  └─ LogStreamingPak                      → .pak 다운로드 & IoStore 마운트

[기본값 복원]
  └─ onClickClearAnimation
  └─ AvatarAPI/GetDefaultAnimations       → 기본 애니 재장착
```

---

## ✅ TC-1. 탐색 (P0) — 마켓플레이스 & 커마 진입

- [ ] **1-1** 마켓플레이스에서 `Animations` 카테고리 노출 확인
- [ ] **1-2** 마켓플레이스에서 `Emotes` 카테고리 노출 확인
- [ ] **1-3** 커스터마이즈에서 `Animations` 탭 진입 시 `Bundle` / `Emotes` 서브탭 2개 노출
- [ ] **1-4** 미보유 아이템과 보유 아이템이 탭에서 구분되어 노출
- [ ] **1-5** `Bundle` 탭 → logcat `categoryId: BundleAnimation` 요청 발생
- [ ] **1-6** `Emotes` 탭 → logcat `categoryId: Emote` 요청 발생
- [ ] **1-7** `MyItem` ↔ `Marketplace` 탭 전환 시 화면 & API 정상 갱신
- [ ] **1-8** *(Spec)* Marketplace Bundle GridItem 클릭 → Idle 포즈 정지 후 **Tooltip 영역 노출** & 애니메이션 **자동 루핑** (최소 3s 간격)
- [ ] **1-9** *(Spec)* Tooltip Arrow indicator 클릭 → 순서대로 애니 전환 (`Idle → Walk → Run → Jump → Fall → Sprint`) / 역순 지원
- [ ] **1-10** *(Spec)* Marketplace Info FAB(ⓘ) 클릭 → 번들 Bottomsheet 노출
- [ ] **1-11** *(Spec)* Bottomsheet Detail 영역 List 클릭 → Bottomsheet 닫히고 해당 애니메이션 재생
- [ ] **1-12** *(Spec)* 커스터마이즈 Animation 탭 진입 (슬롯 미등록) → 기본 Idle **Actived** & 애니메이션 재생
- [ ] **1-13** *(Spec)* 커스터마이즈 Animation 탭 진입 (슬롯 등록됨) → 등록된 **Idle 애니메이션** 재생
- [ ] **1-14** *(Spec)* `Only` 토글 → 보유 아이템만 필터 (Marketplace 서브탭)

---

## ✅ TC-2. 획득 (P0) — Animations Bundle & Emote 구매

- [ ] **2-1** 마켓플레이스에서 번들 팩 2종 가격 노출 확인 (Zombie: 150 Bluc / Skate: 100 Bluc)
- [ ] **2-2** 미구매 상태 → `HasEquipableItems` 응답 `false` & 구매 버튼 활성화
- [ ] **2-3** Zombie Pack 구매 완료 → `anim:35~40` 모두 `HasEquipableItems: true` 전환
- [ ] **2-4** Skate Pack 구매 완료 → `anim:41~46` 모두 `HasEquipableItems: true` 전환
- [ ] **2-5** 구매 완료 후 UI 버튼 → 구매 버튼 → 장착 버튼으로 변경
- [ ] **2-6** 이모트(`emote:76899` / `76999` / `77099`) 개별 구매 가능
- [ ] **2-7** Item Purchases 페이지에 구매한 Animations / Emote 항목 노출
- [ ] **2-8** BLUC 잔액 부족 시 구매 불가 처리 (에러 메시지 노출)
- [ ] **2-9** *(Spec)* Save 버튼 클릭 → Buy 바텀시트 노출 (번들명 + 가격 + Total)
- [ ] **2-10** *(Spec)* 구매 후 "**Share your New Look!**" 툴팁 노출 조건: Animations + 코스튬 아이템 **함께 구매** 시에만 노출 / Animations만 구매 시 미노출
- [ ] **2-11** *(Spec)* 구매 후 리스트 클릭 → "Share your New Look!" 툴팁 제거 & Animation 선택 툴팁 노출(0s) & 해당 애니 Idle부터 재생(루핑)

---

## ✅ TC-3. 장착 (P0) — 슬롯 단위 Animations 장착·해제

### 기본 장착
- [ ] **3-1** 커스터마이즈 진입 → `GetDefaultAnimations` 응답 6종 확인
  - Default Idle   → `assetId: 74199`
  - Default Jump   → `assetId: 74499`
  - Default Fall   → `assetId: 74699`
  - Default Run    → `assetId: 74799`
  - Default Sprint → `assetId: 74899`
  - Default Walk   → `assetId: 74999`
- [ ] **3-2** 6종 모두 `A2U_EQUIP_ANIMATION_ITEM` 커맨드 발생 확인

### 번들 슬롯 상태 표시 (UX Spec 케이스)
- [ ] **3-3** `아무것도 없는 상태` → Bundle 슬롯 **Empty** 표시 (기본 아이콘)
- [ ] **3-4** *(Spec)* `A Bundle 장착 → 모든 개별 파츠를 B Bundle로 교체` → Bundle 슬롯 **B Bundle의 Idle 기준 썸네일** 표시
- [ ] **3-5** `A Bundle 장착 → 하위 슬롯 전체 unequip` → 슬롯 **Empty 표시**
- [ ] **3-6** *(Spec)* `아무 장착 안 한 상태 → 각 탭마다 개별 아이템 장착` → Bundle 슬롯 **Custom** 표시
- [ ] **3-7** *(Spec)* `아무 장착 안 한 상태 → A Bundle 모든 아이템 개별 장착` → Bundle 슬롯 **A 번들 썸네일** 표시
- [ ] **3-8** `A Bundle Idle + B Bundle Walk 혼합 장착` → Bundle 슬롯 **Custom 표시**
- [ ] **3-9** *(Spec)* Bundle ListItem 클릭 시 → Bundle로 **전체 슬롯** 연관 구성물 전부 장착 & **Idle 애니메이션 재생**

### 개별 슬롯 단위 교체
- [ ] **3-10** Bundle 장착 후 개별 슬롯(예: Idle)만 다른 Bundle로 교체 가능
- [ ] **3-11** 슬롯 개별 교체 후 Bundle 슬롯 상태 **Custom 표시** 전환 확인
- [ ] **3-12** Zombie Idle 장착 → logcat `type: IDLE_ANIMATION`, `assetId: 75099`
- [ ] **3-13** Skate Idle  장착 → logcat `type: IDLE_ANIMATION`, `assetId: 75999`
- [ ] **3-14** 번들 선택 시 6종 `A2U_EQUIP_ANIMATION_ITEM` 커맨드 모두 발생

### Idle 슬롯 특수 동작 (Spec)
- [ ] **3-15** *(Spec)* Idle 탭 클릭 → Idle 슬롯에 해당 아이템 노출 + **Bundle 슬롯에도 동일 이미지** 노출 + 애니메이션 재생
- [ ] **3-16** *(Spec)* Idle 탭 제거 → Idle 슬롯 **Empty** + **Bundle 슬롯도 Empty** + 애니메이션 **Stop**

### 에셋 다운로드
- [ ] **3-17** `.pak` 다운로드 → `LogIoDispatcher: Mounting container` 성공
- [ ] **3-18** 인게임 캐릭터 움직임이 장착한 애니메이션으로 변경 확인

### 해제 (Clear / Reset)
- [ ] **3-19** Clear 버튼 → `onClickClearAnimation` 이벤트 & `GetDefaultAnimations` 재호출
- [ ] **3-20** Clear 후 Bundle 슬롯 **Empty 표시** 전환 확인
- [ ] **3-21** Clear 후 캐릭터 기본 애니메이션으로 복원 확인
- [ ] **3-22** *(Spec)* Clear 시 토스트 메시지 노출: "Animation slot has been reset" + **Undo 버튼**
- [ ] **3-23** *(Spec)* Undo 클릭 → Clear 이전 슬롯 상태로 **복원** + 토스트 사라짐
- [ ] **3-24** *(Spec)* 토스트 **2초 후 자동 사라짐** 또는 **외부 영역 클릭 시** 사라짐
- [ ] **3-25** *(Spec)* 슬롯에 등록된 애니메이션이 **없는 상태**에서 Clear → 토스트 **미노출**
- [ ] **3-26** *(Spec)* 기본 제공 애니메이션 외 이미 장착중인 슬롯을 한 번 더 클릭 → 오버레이 기본 애니메이션 슬롯 **Actived** 처리
- [ ] **3-27** *(Spec)* 기본 제공 애니메이션을 장착중인 상태에서 한 번 더 클릭 → **별도의 동작 X**

### Marketplace ↔ Customize 탭 전환
- [ ] **3-28** *(BUG-02)* Marketplace에서 번들 프리뷰 후 Customize 전환 → UE 애니 / UI 슬롯 / 번들 선택 **3가지 일치** 확인
- [ ] **3-29** *(BUG-02)* 탭 전환 시 **Undo 토스트 자동 노출 안 됨** 확인

---

## ✅ TC-3B. 저장 (P0) — Save & 구매 플로우

- [ ] **3B-1** *(PRD)* Animations 슬롯 변경 시 **Save 버튼 활성화**, 탭 시 저장 완료
- [ ] **3B-2** *(BUG-06)* 이모트 착용 시 Save 버튼 **비활성화** 확인 (이모트는 슬롯 미변경)
- [ ] **3B-3** *(PRD)* 미보유 Animations 착용 후 Save → 구매 리스트 노출 (Bundles 정보 대표 표시)
- [ ] **3B-4** *(PRD)* Animations·Emote **단독** 장착 후 Save → "Share your New Look!" **미노출** (다른 코스튬 최소 1개 함께 착용 시에만 노출)

---

## ✅ TC-4. 이모트 구매 & 재생 (P0)

- [ ] **4-1** Emote 탭에 3종 썸네일 정상 노출
  - `emote:76899` Meditation (100 Bluc)
  - `emote:76999` Rejection  (150 Bluc)
  - `emote:77099` Salute     (200 Bluc)
- [ ] **4-2** 미구매 상태 → `HasEquipableItems` 3종 `false` & 구매 버튼 노출
- [ ] **4-3** 구매 후 → 해당 specId `true` 전환 & 장착 버튼으로 변경
- [ ] **4-4** 이모트 선택 → EMOTE 타입 커맨드 & 캐릭터 프리뷰 재생
- [ ] **4-5** 이모트 에셋 다운로드 → `76899 / 76999 / 77099` `.pak` 다운로드 확인
- [ ] **4-6** 이모트 탭 이탈 시 → `A2U_CANCEL_EMOTE` 커맨드 발생
- [ ] **4-7** 인게임 캐릭터 이모트 모션 정상 재생
- [ ] **4-8** *(Spec)* 이모트 클릭 시 → 이모트 재생, Active 상태 시 **루프**
- [ ] **4-9** *(Spec)* 이모트 Active 해제 시 → **기본 애니메이션으로 복귀**
- [ ] **4-10** *(Spec)* 커스터마이즈 Emote 탭 (미보유) → "You have no items to show" + **Go Shopping** 버튼 노출

---

## ✅ TC-5. 사용 (P0) — 인게임 Animations & Emote

### Animations 인게임
- [ ] **5-1** 인게임에서 장착한 Bundle 애니메이션(Idle / Walk / Run / Jump / Fall / Sprint) 모두 정상 재생
- [ ] **5-2** *(PRD)* 장착된 Animations은 **다른 유저에게도 동일하게** 노출
- [ ] **5-3** *(PRD)* Idle 루프 정책: Idle(1) 기본 루프 → **최소 10초** 후 Idle(2)~(3) 랜덤 블렌딩 1회 → Idle(1) 복귀 반복
- [ ] **5-4** *(PRD)* 캐릭터 사망 후 리스폰 → 장착된 Animations **유지**
- [ ] **5-5** *(PRD)* 크리에이터 휴머노이드 디스크립션 적용 월드 → 유저 커스텀 **전체 무시** (슬롯 일부만 변경해도 전체 강제)
- [ ] **5-6** *(PRD)* 크리에이터 휴머노이드 디스크립션 미적용 월드 → 유저 커스텀 Animations **정상 적용**

> 인월드 테스트: `chart → AnimAlphaTest` (일반 월드) / `chart → AnimDescInitialTest` (휴머노이드 디스크립션 적용 월드)

### Emote 인게임
- [ ] **5-7** 인게임 HUD에서 `Emote` + `Poses` 탭 **단일 탭으로 통합** 확인
- [ ] **5-8** 통합 탭 내 이모트 목록 → **최근 구매 순 정렬** 확인
- [ ] **5-9** 통합 탭에서 이모트 선택 → 기존 동일한 애니메이션 재생 로직 유지
- [ ] **5-10** 인게임 이모트 실행 중 이동 입력 시 → 이모트 정상 취소
- [ ] **5-11** *(PRD)* 이모트 재생 시 **다른 유저에게도 동일하게** 노출, Animations 슬롯 영향 없음
- [ ] **5-12** *(PRD)* **Emote Together**: 나 또는 상대가 해당 이모트 미보유 상태에서도 재생 가능

### 프로필 & 구매 내역
- [ ] **5-13** *(PRD)* 프로필 페이지 → 기존 Emote 탭 **제거** 확인
- [ ] **5-14** *(PRD)* Item Purchases 페이지 → BLUC으로 구매한 Animations·Emote 항목 **노출** 확인

---

## ✅ TC-6. L10N (다국어 텍스트)

> 영어 / 포르투갈어(pt) / 스페인어(es-419) 3개 언어 확인

- [ ] **6-1**  `Animations` 탭명    → EN: `Animations`                   / PT: `Animações`              / ES: `Animaciones`
- [ ] **6-2**  `Emotes` 탭명        → EN: `Emotes`                       / PT: `Emotes`                 / ES: `Emotes`
- [ ] **6-3**  `Bundle` 탭명        → EN: `Bundle`                       / PT: `Pacote`                 / ES: `Paquete`
- [ ] **6-4**  슬롯명 Idle          → EN: `Idle`                         / PT: `Parado`                 / ES: `Quieto`
- [ ] **6-5**  슬롯명 Walk          → EN: `Walk`                         / PT: `Andar`                  / ES: `Caminar`
- [ ] **6-6**  슬롯명 Run           → EN: `Run`                          / PT: `Correr`                 / ES: `Correr`
- [ ] **6-7**  슬롯명 Jump          → EN: `Jump`                         / PT: `Pular`                  / ES: `Saltar`
- [ ] **6-8**  슬롯명 Fall          → EN: `Fall`                         / PT: `Queda`                  / ES: `Caída`
- [ ] **6-9**  슬롯명 Sprint        → EN: `Sprint`                       / PT: `Disparar`               / ES: `Sprint`
- [ ] **6-10** Custom 상태 표시     → EN: `Custom`                       / PT: `Custom`                 / ES: `Custom`
- [ ] **6-11** Clear 버튼           → EN: `Clear`                        / PT: `Limpar`                 / ES: `Borrar`
- [ ] **6-12** Clear 완료 토스트    → EN: `Animation slot has been reset` / PT: `Slot de animação resetado` / ES: `Slot de animación reiniciado`
- [ ] **6-13** Undo 버튼            → EN: `Undo`                         / PT: `Desfazer`               / ES: `Deshacer`

---

## ✅ TC-7. 에지 케이스 & 예외

- [ ] **7-1** Wi-Fi 끈 상태에서 마켓 진입 → 에러 메시지 노출, 크래시 없음
- [ ] **7-2** 에셋 다운로드 중 홈 버튼 → 재진입 시 다운로드 재개 또는 완료
- [ ] **7-3** 빠른 탭 연속 전환 → gRPC 중복 요청 없음 (또는 이전 요청 취소)
- [ ] **7-4** 이모트 재생 중 카테고리 이동 → `A2U_CANCEL_EMOTE` & 이모트 정지
- [ ] **7-5** 동일 아이템 재선택 → 중복 장착 커맨드 미발생 또는 정상 처리
- [ ] **7-6** Bundle 장착 후 앱 재시작 → 커스터마이즈 재진입 시 장착 상태 유지
- [ ] **7-7** Bundle Idle만 교체 후 앱 재시작 → Custom 상태 및 슬롯 구성 유지
- [ ] **7-8** *(BUG-02)* Marketplace → Customize 빠르게 반복 전환 → 상태 불일치·크래시 없음
- [ ] **7-9** *(BUG-04)* 이미 소유한 번들 → 구매 버튼이 아닌 **장착 버튼** 노출 확인
- [ ] **7-10** *(BUG-05)* 구매 후 아이템 터치 → **레드닷(New 뱃지) 제거** 확인
- [ ] **7-11** *(BUG-07)* 번들 미리보기 Chevron 클릭 시 자동 롤링 타이머 중첩 → **1번만 넘어감** 확인
- [ ] **7-12** *(BUG-08)* 커마탭 애니/이모트 탭 진입 시 컬러 변경 UI **미노출** 확인

---

## 🐛 발견된 버그
> 상세 내용: [overdare_bug_list.md](./overdare_bug_list.md)

| BUG | 우선순위 | 요약 | 담당 |
| --- | -------- | ---- | ---- |
| **BUG-01** | 🔴 P0 | 번들명 "Zombie" → Spec "Ninja" 불일치 | Server @김상현 |
| **BUG-02** | 🔴 P0 | Marketplace → Customize 전환 시 3-way 상태 불일치 + Undo 토스트 자동 노출 | Android @조현철 |
| **BUG-03** | 🟡 P1 | 번들 미리보기 롤링 순서 불일치 (Spec vs 실제) | Unreal @정석영 |
| **BUG-04** | 🟡 P1 | 이미 소유한 번들이 구매 가능으로 표기됨 | Android @조현철 |
| **BUG-05** | 🟡 P1 | 구매 후 레드닷(New 뱃지) 미제거 | Android @조현철 |
| **BUG-06** | 🟡 P1 | 이모트 착용 시 Save 버튼 계속 노출 | Android @조현철 |
| **BUG-07** | 🟢 P2 | 미리보기 타이머 중첩 (2번 넘겨짐) | Unreal/Android |
| **BUG-08** | 🟢 P2 | 커마탭 애니/이모트 진입 시 컬러 변경 미제거 | Android @조현철 |

---

## ⚠️ Spec vs Dev 확인 필요 사항

- [ ] **Stylish Animation Pack** — Figma에 존재하나 개발 빌드에 미노출 (Default와 동일?)
- [ ] **가격 불일치** — Figma 270 vs 개발 빌드 100~200 Bluc (기획 확인 필요)
- [ ] **Climb / Swim 애니메이션** — 목업에 존재하나 앱 미노출 (향후 추가 예정?)

---

## 📤 QA 완료 후 리포트 항목

### 필수 첨부
- [ ] 각 TC Pass / Fail 결과 (위 체크리스트 완성본)
- [ ] Fail 항목별 스크린샷 또는 화면 녹화 파일
- [ ] logcat 로그 파일 (`~/Desktop/marketplace_realtime.log` 또는 별도 캡처본)

### 리포트 포함 내용
- [ ] **BUG-01** 기획 확인 결과 및 수정 여부
- [ ] **BUG-02** Marketplace ↔ Customize 상태 동기화 수정 여부
- [ ] **Spec vs Dev 불일치** — Stylish 번들 / 가격 / Climb·Swim 기획 확인 결과
- [ ] **에셋 URL 검증** — CDN 응답 정상 여부 (`asset-dev.cdn.ovdr.io`)
- [ ] 신규 발견 버그 목록 → [overdare_bug_list.md](./overdare_bug_list.md)에 추가 후 링크 공유

### 리포트 대상
| 채널             | 내용                                        |
| ---------------- | ------------------------------------------- |
| JIRA `OVDR-8656` | TC 결과 + 버그 링크 첨부                    |
| Slack DM         | BUG-01 기획 확인 → @이재니                  |
| Slack DM         | BUG-02 Android 수정 요청 → @조현철          |
| Slack DM         | 서버 수정 요청 (이름/가격) → @김상현        |
| Slack DM         | Spec vs Dev 불일치 확인 → @이재니           |
