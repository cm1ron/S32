# 🐛 Animation / Emote 버그 리스트
> 발견 빌드: `com.overdare.overdare.dev`  
> QA 체크리스트: [overdare_qa_checklist.md](./overdare_qa_checklist.md) | 에셋 목록: [overdare_assets.md](./overdare_assets.md)  
> ⚠️ 정식 브랜치 QA 시 아래 항목 재확인 후 JIRA 등록

---

## BUG-01. "Zombie Pack" 번들 이름 오류 🔴 (P0)
> 발견 일시: 2026-03-11 | 발견 방법: 목업 아이콘(`Animation_Pack_Icon.zip`) vs 로그 비교  
> Figma UX Spec: 번들명 **Ninja Animation Pack**

### 현상
| 항목          | Figma Spec (디자인 의도)            | 앱 로그 (서버 데이터)                 |
| ------------- | ----------------------------------- | ------------------------------------- |
| 팩 이름       | **Ninja Animation Pack**            | ❌ `"Zombie Animations Pack"`          |
| 개별 에셋명   | `Ninja_Idle`, `Ninja_Walk` 등       | ❌ `"Zombie Idle"`, `"Zombie Walk"` 등 |
| bundle specId | -                                   | `bundle_anim:48`                      |
| Product ID    | -                                   | `cmmexma7z01tno5u9ff87v2ap`           |

**모션(에셋) 자체는 닌자 스타일인데, 서버에 등록된 번들 이름과 에셋 이름이 "Zombie"로 잘못 설정됨**

### 영향 범위
- 앱 UI 마켓플레이스 노출 이름
- 커스터마이즈 슬롯 표시명
- 구매 후 아이템 목록 표시명

### 정식 QA 재확인 포인트
- [ ] 앱 마켓플레이스 → Animations → 두 번째 팩 이름 확인
- [ ] 커스터마이즈 → MyItem → Bundle 탭에서 이름 확인
- [ ] logcat `bundle_anim:48` 응답의 `name` 필드 확인

### 재현 방법
1. 개발 빌드 실행
2. 커스터마이즈 → Animations → Bundle 탭 진입
3. 두 번째 팩 이름 확인 → "Zombie Animations Pack" 노출

### 수정 방향
- 서버 측 번들/에셋 이름 수정 (`Zombie` → `Ninja`)

### 담당자
- 기획 확인: @Jaeni Lee (이재니)
- 서버 수정: @Sanghyun Kim (김상현)

### 상태
- [ ] 기획 의도 확인
- [ ] 서버 수정 요청
- [ ] 수정 완료 확인

---

## BUG-02. Marketplace → Customize 전환 시 애니메이션 상태 3-way 불일치 🔴 (P0)
> 발견 일시: 2026-03-12 | 발견 방법: 실시간 logcat + 화면 비교  
> Figma UX Spec 근거: `커스터마이즈 - Animation` 화면 참조

### 현상

Marketplace에서 번들을 선택(프리뷰)한 뒤 Customize 탭 → Animations로 이동하면 **3가지 상태가 각각 불일치**:

| 영역                   | 실제 상태                               | 기대 상태 (UX Spec 기준)                                       |
| ---------------------- | --------------------------------------- | -------------------------------------------------------------- |
| UE 애니메이션 재생     | ❌ Marketplace 프리뷰 애니 계속 재생 중  | 슬롯 미등록 시 → 기본 Idle 재생 / 등록 시 → 등록된 Idle 재생   |
| 슬롯 리스트 (UI)       | ❌ Default 아이템들 표시                 | 재생 중인 애니와 일치                                          |
| 번들 선택 상태 (UI)    | ❌ 아무 번들도 선택 안 됨               | 슬롯 미등록 시 → 선택 없음 / 등록 시 → 해당 번들 Actived       |

**추가 이상 동작:**
- 유저가 Clear를 누르지 않았는데 `onClickProduct`가 자동 트리거 → Default Pack 선택
- Clear 전용인 **Undo 토스트**가 탭 전환만으로 노출됨 (UX Spec: Clear 버튼 클릭 시에만 토스트)

### UX Spec 근거

Figma `커스터마이즈 - Animation` 화면:
> - 슬롯에 등록된 Animation이 **없는 경우** → 탭 진입 시 오버레이 기본 Idle Actived 및 애니메이션 재생
> - 슬롯에 등록된 Animation이 **있는 경우** → 탭 진입 시 등록된 Idle 애니메이션 재생

Figma `Reset` 화면:
> - Clear 버튼 클릭 → 기본 Idle 애니메이션 세팅
> - 토스트: Slot 초기화 된 경우만 노출 / Slot에 등록된 애니메이션이 없으면 미노출
> - 토스트는 2초 후 사라지거나 외부 영역 클릭 시 사라짐

### 로그 근거

```
16:15:59.171  A2U_EQUIP assetId:75999 (Skate Idle)     ← Marketplace 프리뷰
16:16:00.187  onClickProduct: Skate Pack (bundle_anim:49)
16:16:04.198  onClickToggleTab: Customize               ← 탭 전환
16:16:04.201  A2U_STOP_ANIMATION_ITEM                   ← 애니 정지 명령
16:16:07.930  A2U_EQUIP assetId:75999 (Skate Idle)     ← 커마 진입인데 Skate 다시 장착 ⚠️
16:16:09.583  onClickProduct: Default Animations Pack   ← ViewModel 자동 트리거 ⚠️
16:16:09.596  CancellableToast(cancellable=true)        ← Undo 토스트 노출 ⚠️
```

### 정식 QA 재확인 포인트
- [ ] Marketplace → 번들 선택(프리뷰) → Customize 탭 전환 → Animations 진입
- [ ] 캐릭터 애니메이션이 **저장된 상태**(또는 기본 Idle)로 복원되는지 확인
- [ ] 슬롯 리스트 UI가 재생 중인 애니와 일치하는지 확인
- [ ] 번들 선택 상태가 실제 장착 상태와 일치하는지 확인
- [ ] Undo 토스트가 **Clear 버튼 미클릭** 시 노출되지 않는지 확인
- [ ] logcat에서 `onClickProduct` 자동 트리거 여부 확인

### 재현 방법
1. 개발 빌드 실행 → 커스터마이즈 진입
2. Marketplace 탭 → Animations → 아무 번들 선택 (프리뷰 재생 확인)
3. Customize 탭 전환 → Animations 카테고리 진입
4. 확인 사항:
   - 캐릭터: Marketplace 프리뷰 애니 계속 재생 중
   - 슬롯 리스트: Default 아이템들 표시
   - 번들 선택 UI: 아무것도 선택 안 됨
   - Undo 토스트 자동 노출

### 영향 범위
- Marketplace ↔ Customize 간 상태 동기화 전체
- `CustomizeViewModel` 내 번들 프리뷰 상태 관리
- UE Bridge 애니메이션 장착 명령 순서
- Clear 토스트 노출 조건

### 수정 방향
- Customize 탭 전환 시 Marketplace 프리뷰 상태를 명시적으로 정리(dispose)
- Customize 진입 시 실제 저장된 장착 상태 기준으로 UE + UI 동기화
- `onClickProduct` 자동 트리거 제거 → 상태 복원은 별도 로직으로 처리
- 토스트 노출 조건: Clear 버튼 클릭 시에만 (UX Spec 준수)

### 담당자
- Android: @Hyunchul Jo (조현철)
- 기획 확인: @Jaeni Lee (이재니)

### 상태
- [ ] 기획 의도 확인 (Marketplace 프리뷰 → 커마 전환 시 기대 동작)
- [ ] Android 수정
- [ ] 수정 완료 확인

---

## BUG-03. 번들 미리보기 롤링 순서 불일치 🟡 (P1)
> 발견: 스모크테스트 TC#2 | PRD 근거: `[발견] 마켓플레이스 신규 탭`

### 현상
| 항목 | PRD/Spec 정의 | 실제 동작 |
| ---- | ------------- | --------- |
| 롤링 순서 | `Idle → Walk → Run → Jump → Fall → Sprint` | ❌ `Idle → Jump → Fall → Run → Sprint → Walk` |

PRD: "롤링 순서: Idle, Walk, Run, Jump (Start-Loop-End 3종), Fall, Sprint 순서로 무한 루프"

### 정식 QA 재확인 포인트
- [ ] 마켓플레이스 → Animations → 번들 선택 → 롤링 순서 확인
- [ ] 자동 롤링이 `Idle → Walk → Run → Jump → Fall → Sprint` 순서인지 확인
- [ ] 수동 화살표 Chevron으로 넘길 때도 동일 순서인지 확인

### 담당자
- Unreal: @Seokyoung Jeong (정석영)

### 상태
- [ ] 수정 요청
- [ ] 수정 완료 확인

---

## BUG-04. 이미 소유한 번들이 구매 가능으로 표기됨 🟡 (P1)
> 발견: 스모크테스트 이슈 모음

### 현상
이미 구매 완료한 번들이 마켓플레이스에서 여전히 구매 가능 상태로 노출됨.
`HasEquipableItems: true`인데도 구매 버튼이 활성화되어 있을 수 있음.

### 정식 QA 재확인 포인트
- [ ] 번들 구매 완료 후 마켓플레이스 재진입 → 구매 버튼 → **장착 버튼**으로 변경 확인
- [ ] logcat `HasEquipableItems` 응답 `true`인데 구매 버튼 노출 여부 확인

### 담당자
- Android: @Hyunchul Jo (조현철)

### 상태
- [ ] 수정 요청
- [ ] 수정 완료 확인

---

## BUG-05. 구매 후 레드닷(New 뱃지) 미제거 🟡 (P1)
> 발견: 스모크테스트 이슈 모음

### 현상
애니메이션/이모트 구매 후 아이템을 터치해도 레드닷(New 뱃지)이 사라지지 않음.
구매한 **모든 아이템**에서 동일 증상.

### 정식 QA 재확인 포인트
- [ ] 번들/이모트 구매 후 해당 아이템 터치 → 레드닷 제거 확인
- [ ] 커스터마이즈 탭 재진입 시 레드닷 상태 확인

### 담당자
- Android: @Hyunchul Jo (조현철)

### 상태
- [ ] 수정 요청
- [ ] 수정 완료 확인

---

## BUG-06. 이모트 착용 시 Save 버튼 계속 노출 🟡 (P1)
> 발견: 스모크테스트 이슈 모음

### 현상
이모트를 착용(선택)하면 Save 버튼이 활성화되는데, **이모트는 슬롯 변경이 아니므로 Save가 활성화되면 안 됨**.

### PRD 근거
> "Emote: 유저가 직접 실행하는 일회성 액션 표현 아이템으로, 아바타의 기본 동작 단위의 Animations 슬롯값을 변경하지 않음"

### 정식 QA 재확인 포인트
- [ ] 커스터마이즈 → Emotes 탭 → 이모트 선택 → Save 버튼 **비활성화** 확인
- [ ] Animations Bundle 선택 시에만 Save 활성화 확인

### 담당자
- Android: @Hyunchul Jo (조현철)

### 상태
- [ ] 수정 요청
- [ ] 수정 완료 확인

---

## BUG-07. 미리보기 타이머 중첩 (2번 넘겨짐) 🟢 (P2)
> 발견: 스모크테스트 이슈 모음

### 현상
마켓플레이스 번들 미리보기에서 화살표(Chevron)로 넘길 때, 자동 롤링 타이머와 중첩되어 **2번 넘겨지는** 경우 발생.

### 정식 QA 재확인 포인트
- [ ] 마켓플레이스 → 번들 선택 → Chevron 클릭 시 1번만 넘어가는지 확인
- [ ] 자동 롤링 타이머 직전에 Chevron 클릭 → 중첩 넘김 발생 여부

### 담당자
- Unreal: @Seokyoung Jeong (정석영) / Android: @Hyunchul Jo (조현철)

### 상태
- [ ] 수정 요청
- [ ] 수정 완료 확인

---

## BUG-08. 커마탭 애니/이모트 진입 시 컬러 변경 미제거 🟢 (P2)
> 발견: 스모크테스트 이슈 모음

### 현상
커스터마이즈 탭에서 애니메이션/이모트 탭 진입 시, 컬러 변경 옵션이 표시되면 안 됨 (Figma 시안 참고).

### 정식 QA 재확인 포인트
- [ ] 커스터마이즈 → Animations 탭 진입 시 컬러 변경 UI **미노출** 확인
- [ ] 커스터마이즈 → Emotes 탭 진입 시 컬러 변경 UI **미노출** 확인

### 담당자
- Android: @Hyunchul Jo (조현철)

### 상태
- [ ] 수정 요청
- [ ] 수정 완료 확인

---

## ⚠️ Spec vs Dev 불일치 사항 (확인 필요)

> 아래는 Figma UX Spec과 개발 빌드 간 차이점으로, 정식 QA 전 기획 확인이 필요한 항목입니다.

### 1. 번들 이름 불일치
| Figma Spec        | 개발 빌드 (서버 데이터)  | 비고                    |
| ----------------- | ------------------------ | ----------------------- |
| Stylish Animation Pack | Default Animations Pack (무료) | Stylish = Default? 별도 번들? |
| Ninja Animation Pack   | Zombie Animations Pack   | → **BUG-01** 해당        |
| Skate Animation Pack   | Skate Animations Pack    | ✅ 일치                   |

### 2. 가격 불일치
| Figma Spec (각 270) | 개발 빌드            | 비고           |
| ------------------- | -------------------- | -------------- |
| Stylish: 270        | Default: 무료        | 기획 확인 필요 |
| Ninja: 270          | Zombie: 150 Bluc     | 기획 확인 필요 |
| Skate: 270          | Skate: 100 Bluc      | 기획 확인 필요 |
| Emote 3종: 270 each | 100 / 150 / 200 Bluc | 기획 확인 필요 |

### 3. "Stylish" 번들 존재 여부
- Figma에는 **Stylish Animation Pack** (270)이 구매 가능 번들로 존재
- 개발 빌드에는 **Default Animations Pack** (무료)만 존재
- "Stylish"가 별도 유료 번들이라면 → 아직 미구현?
- "Stylish"가 "Default"의 스토어용 이름이라면 → 이름 불일치

### 확인 필요 담당자
- @Jaeni Lee (이재니): 위 3가지 불일치 사항에 대한 기획 의도 확인

---
