# Overdare Dev Build - 마켓플레이스 에셋 목록
> 수집 일시: 2026-03-11 (개발 빌드: `com.overdare.overdare.dev`)  
> CDN Base: `https://asset-dev.cdn.ovdr.io`  
> QA 체크리스트: [overdare_qa_checklist.md](./overdare_qa_checklist.md)

---

## 📁 디바이스 에셋 저장 경로

| 구분           | 경로                                                                    |
| -------------- | ----------------------------------------------------------------------- |
| 에셋 루트      | `/sdcard/Android/data/com.overdare.overdare.dev/files/Asset/`           |
| 개별 에셋 폴더 | `/sdcard/Android/data/com.overdare.overdare.dev/files/Asset/{assetId}/` |
| 에셋 파일 형식 | `.pak` / `.ucas` / `.utoc` / `.oph` (Unreal Engine IoStore 포맷)        |

> ⚠️ **FBX 파일 없음**: 디바이스에는 Unreal Engine IoStore 포맷(`.pak`, `.ucas`, `.utoc`)으로 쿠킹된 파일만 존재합니다.  
> 원본 FBX는 서버 측 빌드 파이프라인에만 존재하며, CDN에는 쿠킹된 에셋만 배포됩니다.

---

## 🎬 애니메이션 번들 에셋

### Default Animations Pack
> Bundle specId: `bundle_anim:47` | 기본 제공 (무료)

| specId    | 이름           | 타입             | Asset ID | 에셋 URL                                                                 |
| --------- | -------------- | ---------------- | -------- | ------------------------------------------------------------------------ |
| `anim:29` | Default Idle   | IDLE_ANIMATION   | 74199    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/74199/0` |
| `anim:30` | Default Jump   | JUMP_ANIMATION   | 74499    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/74499/0` |
| `anim:31` | Default Fall   | FALL_ANIMATION   | 74699    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/74699/0` |
| `anim:32` | Default Run    | RUN_ANIMATION    | 74799    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/74799/0` |
| `anim:33` | Default Sprint | SPRINT_ANIMATION | 74899    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/74899/0` |
| `anim:34` | Default Walk   | WALK_ANIMATION   | 74999    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/74999/0` |

**썸네일:** `https://asset-dev.cdn.ovdr.io/images/bundle/raw/animation-alpha/{bundleId}/thumbnail/`

| specId    | Bundle ID | 썸네일 해시                        |
| --------- | --------- | ---------------------------------- |
| `anim:29` | 29        | `4ddefdd41c7b47288b49c2633ea8dac0` |
| `anim:30` | 30        | `dba527f0a5a6459881a258952371bb4a` |
| `anim:31` | 31        | `9e1bda11339c4911a9e173a11b13b502` |
| `anim:32` | 32        | `c2078aef77124261beab8b8f9c5f0b8e` |
| `anim:33` | 33        | `22d3ca36e14949dfbddc086ae94cbc22` |
| `anim:34` | 34        | `d873ab83ad114123b38086b2af3250d6` |

---

### Zombie Animations Pack ⚠️ BUG-01: Spec상 "Ninja Animation Pack"
> Bundle specId: `bundle_anim:48` | 가격: **150 Bluc** (Figma Spec: 270)  
> ⚠️ 서버 이름 "Zombie" → Spec/목업 이름 "Ninja" 불일치 | Product ID: `cmmexma7z01tno5u9ff87v2ap`

| specId    | 이름          | 타입             | Asset ID | 에셋 URL                                                                 |
| --------- | ------------- | ---------------- | -------- | ------------------------------------------------------------------------ |
| `anim:35` | Zombie Idle   | IDLE_ANIMATION   | 75099    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75099/0` |
| `anim:36` | Zombie Jump   | JUMP_ANIMATION   | 75399    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75399/0` |
| `anim:37` | Zombie Fall   | FALL_ANIMATION   | 75599    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75599/0` |
| `anim:38` | Zombie Run    | RUN_ANIMATION    | 75699    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75699/0` |
| `anim:39` | Zombie Sprint | SPRINT_ANIMATION | 75799    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75799/0` |
| `anim:40` | Zombie Walk   | WALK_ANIMATION   | 75899    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75899/0` |

**썸네일:** `https://asset-dev.cdn.ovdr.io/images/bundle/raw/animation-alpha/{bundleId}/thumbnail/`

| specId    | Bundle ID | 썸네일 해시                        |
| --------- | --------- | ---------------------------------- |
| `anim:35` | 35        | `69d929aa6f1d4681be330a0282d35336` |
| `anim:36` | 36        | `5e087d21d7e34e6c884078b20b1fbf98` |
| `anim:37` | 37        | `9f32a5edf37c40d08e70492f2c2ab574` |
| `anim:38` | 38        | `6f9b2a94dfb548bbaa3f8f763fc83b7b` |
| `anim:39` | 39        | `8f7430a29b5f43829a4d4acad6ee7d84` |
| `anim:40` | 40        | `a53f4069b43c457cb6e539f2f7b1aa49` |

---

### Skate Animations Pack ✅ 완전 확인
> Bundle specId: `bundle_anim:49` | Product ID: `cmmexmaau01u8o5u9sr9ohca6` | 가격: **100 Bluc** (Figma Spec: 270)

| specId    | 이름         | 타입             | Asset ID | 에셋 URL                                                                 |
| --------- | ------------ | ---------------- | -------- | ------------------------------------------------------------------------ |
| `anim:41` | Skate Idle   | IDLE_ANIMATION   | 75999    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/75999/0` |
| `anim:42` | Skate Jump   | JUMP_ANIMATION   | 76299    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76299/0` |
| `anim:43` | Skate Fall   | FALL_ANIMATION   | 76499    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76499/0` |
| `anim:44` | Skate Run    | RUN_ANIMATION    | 76599    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76599/0` |
| `anim:45` | Skate Sprint | SPRINT_ANIMATION | 76699    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76699/0` |
| `anim:46` | Skate Walk   | WALK_ANIMATION   | 76799    | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76799/0` |

**썸네일:** `https://asset-dev.cdn.ovdr.io/images/bundle/raw/animation-alpha/{bundleId}/thumbnail/`

| specId    | Bundle ID | 썸네일 해시                        |
| --------- | --------- | ---------------------------------- |
| `anim:41` | 41        | `d92134e1142e4d55b251ddef36828c1e` |
| `anim:42` | 42        | `3b61740427e848e6808ca37de5e41a04` |
| `anim:43` | 43        | `26d8043fcf174a46b32d58c65afe61f4` |
| `anim:44` | 44        | `fa706f1d4c3b40608b3e4dd9eda1c9c5` |
| `anim:45` | 45        | `d642aea333d044af8d1aeab20974c4c6` |
| `anim:46` | 46        | *(추가 확인 필요)*                 |

---

## 🎭 이모트 에셋 (Emote Assets) ✅ 완전 확인
> API: `StoreAPI/ListCreatorProducts` (categoryId: `Emote`)

| specId        | 이름       | Asset ID | 가격     | Product ID                  | 구매 여부 | 에셋 URL                                                                 |
| ------------- | ---------- | -------- | -------- | --------------------------- | --------- | ------------------------------------------------------------------------ |
| `emote:76899` | Meditation | 76899    | 100 Bluc | `cmmexmadv01uto5u9ywp9w7f0` | ❌ 미구매  | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76899/0` |
| `emote:76999` | Rejection  | 76999    | 150 Bluc | `cmmexmae801uwo5u9zvzixf9o` | ❌ 미구매  | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/76999/0` |
| `emote:77099` | Salute     | 77099    | 200 Bluc | `cmmexmaem01uzo5u9ms2u34jd` | ❌ 미구매  | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/77099/0` |

**썸네일:** `https://asset-dev.cdn.ovdr.io/images/item/raw/animation-alpha/{assetId}/thumbnail/`

| specId        | 썸네일 해시                        |
| ------------- | ---------------------------------- |
| `emote:76899` | `15fa72294b5847819478287eee12adba` |
| `emote:76999` | `3b060d4ed39a4de69edd817a3dd081ed` |
| `emote:77099` | `dda4cf3f23c2409380858d3435b50613` |

---

## 🗂️ MyItem 탭 서브카테고리 구조

> Marketplace와 MyItem 탭의 서브탭 구성이 다름 (로그 확인)

| 탭              | 서브카테고리                                                    |
| --------------- | --------------------------------------------------------------- |
| **Marketplace** | `Bundle` / `Emotes`                                             |
| **MyItem**      | `Bundle` / `Idle` / `Walk` / `Run` / `Jump` / `Fall` / `Sprint` |

---

## 🔗 URL 패턴 정리

| 구분                   | URL 패턴                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------- |
| **Mesh (쿠킹된 에셋)** | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/{assetId}/0`                        |
| **PAK Manifest**       | `https://asset-dev.cdn.ovdr.io/assets/item/cook/animation-alpha/{assetId}/0/android/{assetId}.opak` |
| **번들 썸네일**        | `https://asset-dev.cdn.ovdr.io/images/bundle/raw/animation-alpha/{bundleId}/thumbnail/{hash}.png`   |
| **이모트 썸네일**      | `https://asset-dev.cdn.ovdr.io/images/item/raw/animation-alpha/{assetId}/thumbnail/{hash}.png`      |

---

## 📡 연관 gRPC API

| API                                   | 용도                                      |
| ------------------------------------- | ----------------------------------------- |
| `EquipableItemAPI/ListEquipableItems` | 카테고리별 장착 가능한 아이템 목록        |
| `AvatarAPI/GetDefaultAnimations`      | 기본 애니메이션 세트 조회                 |
| `StoreAPI/ListCreatorProducts`        | 마켓플레이스 판매 상품 목록 (이모트 포함) |
| `StoreAPI/ListRecommendation`         | 추천 목록                                 |
| `EquipableItemAPI/HasEquipableItems`  | 특정 아이템 보유 여부 확인                |

---

## ⚠️ Figma Spec vs Dev 불일치

| 항목 | Figma Spec | 개발 빌드 | 상태 |
| ---- | ---------- | --------- | ---- |
| 번들 1 이름 | Stylish Animation Pack | Default Animations Pack (무료) | ❓ 미확인 |
| 번들 2 이름 | Ninja Animation Pack | Zombie Animations Pack | ❌ BUG-01 |
| 번들 3 이름 | Skate Animation Pack | Skate Animations Pack | ✅ 일치 |
| 번들 가격 | 각 270 | 무료 / 150 / 100 Bluc | ❌ 불일치 |
| 이모트 가격 | 각 270 | 100 / 150 / 200 Bluc | ❌ 불일치 |

---

## 📦 요약

| 구분                    | 개수     | specId 범위           | assetId 범위  | 이름 확인 |
| ----------------------- | -------- | --------------------- | ------------- | --------- |
| Default Animations Pack | 6개      | `anim:29` ~ `anim:34` | 74199 ~ 74999 | ✅         |
| Zombie Animations Pack  | 6개      | `anim:35` ~ `anim:40` | 75099 ~ 75899 | ✅         |
| Skate Animations Pack   | 6개      | `anim:41` ~ `anim:46` | 75999 ~ 76799 | ✅         |
| Emote (Meditation)      | 1개      | `emote:76899`         | 76899         | ✅         |
| Emote (Rejection)       | 1개      | `emote:76999`         | 76999         | ✅         |
| Emote (Salute)          | 1개      | `emote:77099`         | 77099         | ✅         |
| **합계**                | **21개** |                       |               |           |
