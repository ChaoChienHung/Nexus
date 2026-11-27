# Knowledge Graph Streaming Edge Pruning

## 設計理念（Why Prune the Graph Layer Only?）

在 Nexus 的知識模型中，一篇筆記常會同時連結多個彼此密切相關的 Ontology 概念。例如 `OLMoE` 同時 `explains` `Mixture of Experts (MoE)` 與 `Expert Routing`，而 Ontology 本身已經定義了 `Expert Routing --part_of--> MoE`（或 `MoE --depends_on--> Expert Routing`）。

如果把所有 `doc → concept` 邊全部原封不動畫進 Knowledge Graph，隨著筆記與概念增長，圖譜會迅速出現大量三角形與網狀冗餘邊（hairball），反而遮蔽了真正跨主題的知識骨幹。

但我們**絕不刪除 SSOT 中的連結**。Nexus 將「語意真相層」與「圖譜骨幹層」清楚分開：

| 層級 | 檔案／產物 | 是否剪枝 | 用途 |
| --- | --- | --- | --- |
| **SSOT 語意層** | `wiki/**/index.md`、`concepts.json`、`conceptTopDocs`、Ask / Query CLI | **不剪枝** | 保留完整 `[[concept.*]]` 連結與 BM25 排序，查 `Expert Routing` 依然能找到 `OLMoE` |
| **圖譜編譯層** | `app/.generated/nexus-index.json` 的 `graph.edges` | **標記 `redundant: true`** | 預設在 UI 顯示精簡骨幹，並保留一鍵切換「顯示全部邊」 |

---

## 演算法：Weighted Greedy Streaming Edge Selection

實作位於 [`app/server/graphPruning.ts`](../../app/server/graphPruning.ts)，由 [`app/server/indexer.ts`](../../app/server/indexer.ts) 在編譯索引時自動執行（確定性、零執行期負擔）。

### 1. Concept 子圖加權距離模型

將所有 Concept-to-Concept 關係視為無向加權圖，依語意強度賦予不同邊權重：

| 邊類別 | 關係類型 | 權重 | 設計理由 |
| --- | --- | --- | --- |
| **強結構／因果邊** | `is_a`, `part_of`, `generalizes`, `example_of`, `depends_on`, `enables`, `solves`, `used_in` | `1.0` | 代表緊密的從屬、組成或因果依賴，1–2 跳內仍屬同一概念簇 |
| **弱關聯／對照邊** | `relates_to`, `influences`, `contrasts_with` | `1.5` | 代表跨概念聯想或對照，1 跳可視為相鄰，但不應因連續 2 條弱邊（`1.5 + 1.5 = 3.0`）把遠親誤剪 |

預設遞移冗餘門檻：**`redundancyThreshold = 2.0`**。

在這個設定下：
- **1 條強邊**（`1.0 ≤ 2.0`）：會剪枝（例如 `MoE ← part_of ← Expert Routing`）。
- **2 條強邊**（`1.0 + 1.0 = 2.0 ≤ 2.0`）：會剪枝（例如 `GenRec → Generative Recommendation → Semantic ID ← RQ-VAE` 的強結構鏈）。
- **1 條弱邊**（`1.5 ≤ 2.0`）：會剪枝（直接相鄰的關聯概念不重複拉線）。
- **2 條弱邊**（`1.5 + 1.5 = 3.0 > 2.0`）：**不剪枝**，避免 small-world 效應把不同面向的邊誤刪。
- **1 強 + 1 弱**（`1.0 + 1.5 = 2.5 > 2.0`）：**不剪枝**。

### 2. 逐篇串流選邊流程（Streaming Selection）

對每篇文件 $d$：

1. **相關性排序**：收集 $d$ 的所有 `explains` 與 `mentions` 候選邊，依序按以下優先順序由高到低排列：
   - 邊類型：`explains` 永遠優先於 `mentions`
   - 相關性分數：採用 `app/server/ranking.ts` 計算出的 BM25 + 結構加權分數
   - 決定性平手規則：frontmatter 中出現順序 → `concept_id` 字典序
2. **貪婪加入錨點**：維護該文件已保留的錨點集合 $A(d) = \emptyset$，逐一檢視候選邊 $d \to c$：
   - 若 $|A(d)| \ge \text{maxConceptEdgesPerDoc}$（預設 **6**），標記為 `redundant: true, prunedReason: 'cap'`。
   - 否則在無向加權 Concept 子圖上，從 $A(d)$ 出發執行有界 Dijkstra（距離超過 `2.0` 即停止）：
     - 若 $c$ 可在距離 $\le 2.0$ 內被某個已保留錨點 $a \in A(d)$ 到達，標記為 `redundant: true, prunedReason: 'transitive', coveredBy: a`。
     - 否則保留 $d \to c$，並將 $c$ 加入 $A(d)$。
3. **文件總出度上限**：對該文件的 `links_to`（文件互連）邊套用剩餘額度 `maxTotalEdgesPerDoc - |A(d)|`（預設總上限 **12**），超出部分標記為 `redundant: true, prunedReason: 'cap'`。
4. **Concept-to-Concept 邊永不剪枝**：Ontology 本身的語意骨架完整保留。

---

## 預設參數與本體建模指導原則

```ts
export const GRAPH_PRUNING_DEFAULTS = {
  strongEdgeWeight: 1.0,
  weakEdgeWeight: 1.5,
  redundancyThreshold: 2.0,
  maxConceptEdgesPerDoc: 6,
  maxTotalEdgesPerDoc: 12,
};
```

- **為什麼單篇概念錨點上限設為 `6`？**
  - 經過遞移剪枝後，大多數聚焦的筆記自然只會保留 **1–4 個**核心錨點概念。
  - 若某篇筆記在剪枝後仍超過 6 個彼此不相連的概念簇，通常代表 Ontology 缺少一個更高層的**抽象父概念（Abstract Concept）**來歸納它們；此時優先在 `concepts.json` 補上抽象概念並建立 `is_a` / `part_of` 關聯，而不是放任單篇筆記拉出十幾條星狀邊。
- **為什麼總出度上限設為 `12`？**
  - 保留 `doc → concept`（最多 6 條）加上 `doc → doc`（`links_to`）的合理空間，同時防止長篇綜述文把圖譜拉成高密度節點。

---

## Reader UI 行為

- [`KnowledgeGraph.tsx`](../../app/src/components/KnowledgeGraph.tsx) 預設啟用 **`精簡骨幹` / `Backbone`** 模式：
  - 被標記為 `edge.redundant === true` 的邊**不參與力導向佈局彈力**（確保圖譜骨架清爽不打結），並以極低透明度 **`opacity: 0.1`** 保留為細微背景脈絡。
  - 當滑鼠移至或點擊某個節點時，其相關的冗餘邊會柔和浮現至 `opacity: 0.35`（核心骨幹邊為 `0.96`），讓你兼顧「全景不雜亂」與「局部不錯過關聯」。
- 點擊工具列的 **`Backbone` / `All Edges`**（`精簡骨幹` / `全部邊`）按鈕可隨時將全部邊切換為完整透明度檢視。
