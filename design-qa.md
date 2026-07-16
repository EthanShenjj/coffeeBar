# Design QA

- final result: passed
- target: CoffeeBar 移动端点单模块
- reference visual: `/var/folders/nx/ww_j5y216qz18dj4jlst6pdh0000gn/T/codex-clipboard-ccecf8f8-1545-42c6-9015-0c9e85cce67e.png`
- implementation screenshot: `.codex-artifacts/menu-mobile-390-final.png`
- combined comparison: `.codex-artifacts/menu-qa-comparison.png`
- viewport: `390 x 844`
- verified state: 默认“意式咖啡”Tab、风味系列 Tab、白摩卡规格弹窗

## Required fidelity surfaces

| Surface | Evidence | Result |
| --- | --- | --- |
| 菜单信息架构 | 直接使用“意式咖啡、单品豆 SOE、手冲咖啡、零咖系列、风味系列、季节限定”六个模块，不再增加经典/季节一级切换 | passed |
| 商品归属与数量 | 默认意式咖啡 5 项；风味系列 17 项；商品名称和杯型价格与参考菜单对应 | passed |
| 视觉语言 | 延续参考菜单的黑白、高对比标题、细分隔线、双语模块标题与杯型说明 | passed |
| 移动端适配 | 390px 宽度下底部导航固定；Tab 横向滚动；商品行和主操作触控区域可用 | passed |
| 点单交互 | 点击商品打开规格弹窗；选择白摩卡超大杯后金额由 ¥25 更新为 ¥30 | passed |
| 运行状态 | 浏览器控制台无应用错误；开发热更新提示不影响页面；类型检查、ESLint、13 项单元测试和生产构建通过 | passed |

## Comparison history

1. 首轮实现完成六个模块和菜单商品映射，并将杯型价格直接展示在商品行中。
2. 移动端检查后保留横向 Tab，以避免 390px 下压缩中文模块名称。
3. 规格弹窗复测通过，商品图片、选项、数量和底部操作在 844px 高度内完整可见。

## Severity review

- P0: none
- P1: none
- P2: none
- P3: 390px 下右侧 Tab 通过横向滚动访问，首屏保留部分下一项作为可滚动提示，属于预期行为。

---

# Date and time picker design QA

- Source visual truth path: `/var/folders/nx/ww_j5y216qz18dj4jlst6pdh0000gn/T/codex-clipboard-382be921-35aa-4616-9590-2502733c4077.png`
- Implementation screenshot path: `/tmp/coffeebar-pickup-picker-desktop.png`
- Mobile implementation screenshot path: `/tmp/coffeebar-pickup-picker-mobile.png`
- Combined comparison path: `/tmp/coffeebar-pickup-comparison.png`
- Desktop viewport: `900 × 900`
- Mobile viewport: `390 × 844`
- State: checkout page, pickup date and time picker expanded

## Full-view comparison evidence

The native browser picker used a platform-blue selection color, exposed long independent hour and minute columns, and overflowed the visual language of the checkout card. The implementation replaces it with a CoffeeBar-styled trigger and bounded panel using the existing black, white, zinc, rounded-corner, border, and shadow tokens.

## Focused region comparison evidence

The expanded control was checked at desktop and mobile widths. Date cards, the selected time, the scrollable time grid, the business-hours note, and the panel edge remained readable. The mobile panel had no horizontal overflow, and Playwright could scroll to and select the final `21:30` option.

## Required fidelity surfaces

- Fonts and typography: Uses the app's existing sans and mono stacks, with clear label, selected-value, date, and time hierarchy.
- Spacing and layout rhythm: Trigger and panel align to the checkout field width; date and time controls use the existing radius and spacing scale.
- Colors and visual tokens: Selected states use CoffeeBar black and white instead of native browser blue; secondary content uses the existing zinc palette.
- Image quality and asset fidelity: No raster imagery is required for this control. Calendar, clock, check, and chevron icons use the project's installed icon library.
- Copy and content: Chinese and English labels were verified, including the three-day limit, opening hours, and 30-minute interval.

## Interaction and responsive checks

- Desktop date selection and time selection passed.
- Mobile final-slot selection passed with no horizontal overflow.
- English locale labels and accessible dialog label passed.
- Escape and outside-click dismissal are implemented.
- Browser console errors: none.

## Findings

No actionable P0, P1, or P2 issues remain.

## Comparison history

This was a first-pass comparison with no P0, P1, or P2 fixes required after capture.

final result: passed
