一，产品概述

背景
OpenCode 采用多层配置加载与合并机制，配置源包含远程 .well-known/opencode，全局 ~/.config/opencode/opencode.json{,c}，环境变量指定的自定义配置，项目内 opencode.json{,c}，以及 .opencode 目录等，并使用 deep merge 语义合并，后加载的来源覆盖冲突键。
Oh My OpenCode 通过插件方式增强 OpenCode，并引入自己的配置文件 oh-my-opencode.json，其用户级默认路径位于 ~/.config/opencode/oh-my-opencode.json，项目级可放在 .opencode/oh-my-opencode.json。

目标用户
面向需要频繁在多供应商，多中转，多模型策略之间切换的开发者与团队，例如供应商 A 与中转商 A，供应商 B 与中转商 B，不同项目使用不同插件组合，不同网络环境使用不同 endpoint。

核心价值
（1）多配置方案并发管理与一键激活，避免手工改文件带来的出错与成本。
（2）单一生效原则保证同一时刻只有一套配置进入 OpenCode 的生效路径，从而让“当前环境”可预期且可追踪。
（3）内置语法校验与连通性检测，在写入前发现错误，降低启动失败与隐性网络问题。
（4）可选的使用统计让用户理解各方案的使用频次与活跃时长，辅助整理与优化。

产品边界与非目标
本产品管理的是配置的编排，落盘与切换，不做 OpenCode 内部会话管理，不接入任何第三方 OAuth 流程，不提供任何伪造签名或绕过机制，遵循上游项目安全与合规告知。

二，功能详细设计

2.1 核心概念与对象模型

Profile（配置方案）
一组可独立激活的配置集合，至少包含：
（1）opencode 主配置内容，文件名 opencode.json 或 opencode.jsonc。OpenCode 支持 JSON 与 JSONC，且会优先尝试加载 .jsonc 再回退到 .json。
（2）可选的 oh-my-opencode 扩展配置内容，文件名 oh-my-opencode.json 或 oh-my-opencode.jsonc（产品内部统一用 JSONC 输出，便于注释与人读）。其默认落点为用户级 ~/.config/opencode/oh-my-opencode.json 或项目级 .opencode/oh-my-opencode.json。
（3）元数据：名称，描述，创建时间，最后激活时间，是否启用统计，标签（如“供应商A”“中转商A”），自定义配置目录选择（可选）。

Active Profile（当前生效方案）
同一时刻唯一。激活意味着将该 Profile 的配置以原子方式写入用户选择的目标配置目录中，并确保插件联动关系正确。

Config Location（配置路径策略）
支持三类路径策略：
（1）默认全局目录。Linux 与 macOS 默认使用 ~/.config/opencode/opencode.json{,c}，Windows 默认使用 %APPDATA%/opencode/opencode.json{,c}。
（2）自定义配置目录，使用 OPENCODE_CONFIG_DIR 指向一个目录，该目录像标准 .opencode 目录一样被搜索，用于 agents，commands，modes，plugins 等资源，并在全局与 .opencode 目录之后加载，具备覆盖能力。
（3）自定义配置文件路径，使用 OPENCODE_CONFIG 指向单文件。
本产品重点管理“用户全局目录”与“自定义配置目录”，同时允许用户在界面上切换目标路径策略。

2.2 多配置方案管理（Profile Management）

列表视图与快速切换
（1）左侧或顶部为 Profile 列表，展示名称，标签，最近激活时间，统计开关状态，健康状态（语法，连通性）。
（2）每个 Profile 提供“激活”按钮。激活后该条目呈现明显的 Active 视觉态，并显示“生效路径”与“写入时间”。
（3）切换要求原子性：新配置写入完成且 fsync 成功后，再完成指针切换，避免中间态导致 OpenCode 读到半写入文件。

CRUD
（1）创建：支持从模板创建，复制现有 Profile，或从当前磁盘配置导入。导入时读取目标目录的 opencode.json{,c}，并检测是否存在 oh-my-opencode.json。
（2）查看与编辑：进入编辑页支持双模编辑与校验。
（3）删除：仅删除本软件内的 Profile 数据，不主动删除用户磁盘上的现有配置文件。若要清理磁盘文件，提供单独的“清理向导”，默认关闭，避免误删。

单一生效原则与互斥逻辑
（1）系统持久化多个 Profile。
（2）激活时写入目标目录的实际配置文件。
（3）系统保存一个 active_profile_id，并记录激活事件。
（4）再次激活另一个 Profile 时，先完成新配置写入，再更新 active 指针，再记录旧 Profile 的“本次活跃区间结束”。

兼容性模式
（1）仅 opencode 模式：Profile 只管理 opencode.json{,c}，不写入 oh-my-opencode.json，同时在主配置内不强制插入插件条目。
（2）组合模式：启用 oh-my-opencode 时，必须满足两点：
A. 主配置的 plugin 数组包含 "oh-my-opencode"。在 oh-my-opencode 的卸载指引里，明确通过从 plugin 数组移除该项来禁用插件。
B. 写入对应的 oh-my-opencode.json 到用户级或项目级约定路径。
（3）联动策略：
A. 用户在 UI 中打开“启用 oh-my-opencode”开关时，系统自动在主配置中维护 plugin 数组的包含关系。
B. 用户关闭开关时，系统从 plugin 数组移除 "oh-my-opencode"，并停止写入扩展配置文件。扩展配置文件本身是否删除由用户在清理向导中决定。

2.3 双模编辑（Dual-View Editing）

可视化编辑
（1）基于 Schema 的表单渲染。OpenCode 文档指出配置 schema 定义在 opencode.ai/config.json，编辑器可据此验证与自动补全。
（2）提供常用字段的 GUI，例如 theme，provider/model，server 配置，tools 权限开关，tui 参数等，均来自官方配置文档。
（3）对于 schema 中不常用或未知字段，提供“高级字段”以 JSON Tree 形式编辑。

源码编辑
（1）下方常驻一个代码编辑器（Monaco 或 CodeMirror），展示该 Profile 当前生成的 JSONC。
（2）两向同步：
A. GUI 改动后即时更新源码视图，保持格式化与注释策略一致。
B. 源码改动后进行增量解析与校验，通过后反向更新表单状态。
（3）冲突处理：当源码包含 GUI 不支持的字段时，GUI 保留未知字段的“透传区”，保存时不丢失。

校验逻辑与触发时机
（1）语法校验：每次源码编辑停止输入 500ms 后触发，保存前必触发。JSONC 使用支持注释与 trailing comma 的解析器策略以对齐上游行为。
（2）Schema 校验：保存前触发，必要时在用户开启“严格模式”后改为实时触发。
（3）连通性检测 Connectivity Check：
A. 在保存后自动触发一次，可在设置中关闭自动触发。
B. 在激活前强制触发一次，若失败给出二次确认选项，允许用户仍然激活。
C. 检测目标来源：从配置中提取 URL 或服务地址字段，至少覆盖 provider endpoint 类字段与 mcp remote url 类字段。OpenCode 文档示例中出现远程 .well-known/opencode 以及 mcp remote url 的结构。
D. 异步与超时：每个 URL 单独超时，例如 3 秒，整体并发上限例如 10，避免阻塞 UI。

2.4 路径管理

默认路径
默认指向全局配置目录。Linux 与 macOS 为 ~/.config/opencode/opencode.json{,c}，Windows 为 %APPDATA%/opencode/opencode.json{,c}。

自定义路径切换
（1）支持选择一个目录作为“目标写入目录”。
（2）支持一键切换为 OPENCODE_CONFIG_DIR 模式，软件将帮助用户在启动 opencode 时注入该环境变量的推荐方式，并在应用内保存该模式。该变量的行为与加载顺序在官方文档中有明确描述。
（3）对 Windows 与 macOS 需要提供路径校验与权限提示，尤其是 ProgramData 或系统目录。OpenCode 还存在 managed config 路径如 /etc/opencode 与 C:\ProgramData\opencode，产品默认不写入这些受管路径，仅识别并提示其优先级更高。

多路径并存策略
用户可以保存多个“目标路径配置”，每次激活 Profile 时选择写入到哪个目标路径。常见用法是“个人全局”与“工作全局”两个目录切换。

2.5 使用统计（Usage Stats）

开关与范围
（1）统计默认关闭，按 Profile 单独开启。
（2）只记录与本软件相关的切换与活跃区间，不采集代码内容，不采集模型请求信息。

指标定义
（1）切换频次：激活次数，最近 7 天，30 天。
（2）活跃时长：Profile 处于 Active 状态的累计时长，从激活到下一次切换之间计时。若用户关机或应用被强制退出，采用“最后心跳时间”修正，避免无限延长。
（3）健康率：近 N 次连通性检测成功率。

存储方式
（1）本地 SQLite，表结构包含 profiles，activation_events，connectivity_results，settings。
（2）所有统计数据可一键导出为 JSON，便于用户自检。
（3）提供“一键清空统计”的隐私控制。

2.6 多语言 i18n

范围
简体中文默认，繁体中文，英文，并支持应用内实时切换。

设计要点
（1）字符串资源与 UI 文案分离。
（2）日期，数字，单位本地化。
（3）校验错误信息分级展示，先给用户可读摘要，再提供原始错误详情。

三，UI/UX 设计理念

总体风格
现代，简洁，强调“当前生效方案”的清晰度与切换反馈。参考同类配置切换桌面工具的清爽列表与一键切换心智，例如 cockpit-tools 强调一键切换与多语言支持。

信息架构建议
（1）左侧导航三项：Profiles，Path & Env，Settings。
（2）Profiles 页分为左右两栏：左侧 Profile 列表，右侧详情与编辑。
（3）详情区顶部为状态条：Active 标识，写入路径，最近校验结果。中部为可视化表单。底部为源码编辑器与校验面板。

Profile 列表的关键交互
（1）Active 视觉区分：高对比但不刺眼的高亮背景，带“Active”徽标与生效路径摘要。
（2）一键切换：点击激活后立刻进入“切换中”状态，显示步骤进度：校验，连通性检测，写入，完成。
（3）失败反馈：明确失败发生在哪一步，并提供“查看详情日志”入口。
（4）危险操作：删除与清理分离，删除只影响软件内部数据，清理向导需要二次确认。

双模编辑体验
（1）GUI 与源码同屏，减少在不同页之间跳转。
（2）源码编辑器的错误标注与表单字段联动，高亮出错字段。
（3）提供“格式化 JSONC”“从 Schema 补全缺省字段”“恢复到上次保存”三个快捷动作。

设置页建议
（1）语言切换。
（2）校验策略：是否自动连通性检测，超时阈值，并发上限。
（3）统计隐私：默认关闭，提供全局开关与清空按钮。
（4）写入策略：是否自动备份旧配置，备份保留数量。

四，技术架构方案

4.1 技术选型

桌面框架
推荐 Tauri。理由是 Rust 后端与系统能力天然契合，包体积与性能较优，且能覆盖 Windows 与 macOS Intel 及 Apple Silicon 的发行形态。

前端框架
推荐 React + TypeScript + Vite。理由：
（1）生态成熟，表单与代码编辑器组件选择丰富，Schema 驱动表单可用成熟方案。
（2）适合做复杂状态管理与双向同步。
UI 组件建议使用 shadcn/ui 或 Radix 体系，配合 Tailwind 实现现代简洁风格。状态管理建议 Zustand 或 Jotai。i18n 建议 i18next。

Rust 依赖建议
（1）配置解析：支持 JSONC 的解析方案，或引入兼容注释的 JSONC 解析库，保证与 OpenCode 的 JSONC 特性一致。
（2）网络探测：reqwest + tokio，支持并发与超时。
（3）存储：rusqlite 或 sqlx。
（4）文件原子写：tempfile + 原子 rename + fsync。

4.2 后端 Rust 模块设计

Core Domain
（1）profile_service
职责：Profile CRUD，导入导出，schema 校验入口，激活互斥控制。
关键接口：create_profile，update_profile，delete_profile，activate_profile，get_active_profile。

（2）config_render
职责：将 UI 表单状态渲染为 JSONC 文本，维持字段顺序与注释策略，可插入 $schema 字段用于编辑器提示。官方示例配置包含 $schema 指向 https://opencode.ai/config.json。

（3）config_writer
职责：将渲染后的 opencode 与 oh-my-opencode 配置写入正确路径，并保证原子性。
原子写入流程建议：
A. 计算目标文件路径，例如 <target_dir>/opencode.jsonc，以及扩展配置 <target_dir>/oh-my-opencode.json。
B. 写入临时文件到同目录，例如 opencode.jsonc.tmp。
C. flush 并 fsync 临时文件。
D. 如开启备份，先将旧文件 rename 为带时间戳的备份名，再 fsync 目录。
E. 将 tmp 原子 rename 为正式文件名，再 fsync 目录。
F. 返回写入成功事件。
说明：rename 在同一文件系统内具备原子替换语义，可避免半写入被读取。

（4）compat_service
职责：组合模式联动处理。
A. 当 Profile 启用 oh-my-opencode，确保主配置 plugin 数组包含 "oh-my-opencode"。
B. 当关闭时，移除该项并停止写入扩展配置文件。
C. 同时识别项目级 .opencode/oh-my-opencode.json 的存在并提示用户当前写入的是用户级还是项目级。

（5）connectivity_checker
职责：从配置中抽取 URL，执行异步探测。
实现要点：
A. 解析配置 JSON 为 Value，按白名单路径抽取常见 endpoint 字段。
B. HEAD 优先，若服务不支持 HEAD 则回退 GET，避免误判。
C. 超时与并发控制。
D. 结果落库，并返回给前端做健康提示。

（6）stats_service
职责：统计事件记录与聚合。
A. activation_event 写入。
B. active duration 通过后台定时心跳或前端事件驱动写入最后活跃时间。
C. 提供按 Profile 的聚合查询接口。

数据流向

激活流程的数据流建议如下：
前端点击激活，后端收到 activate_profile(profile_id, target_path_mode)。
后端执行 schema 校验与语法校验。
后端执行连通性检测并返回结果，如失败按策略中断或允许继续。
后端执行 config_writer 原子写入。
后端更新 active_profile_id 与写入 activation_event。
前端刷新列表 Active 状态与提示条。

4.3 前端模块与状态管理

页面与组件
（1）ProfileList：列表，搜索，标签过滤，排序。
（2）ProfileDetail：状态条，表单编辑，源码编辑，校验面板，统计面板。
（3）PathManager：管理默认目录，自定义目录，OPENCODE_CONFIG_DIR 引导。官方明确该变量用于指定自定义配置目录，并参与加载顺序。
（4）Settings：语言，校验策略，统计隐私，备份策略。

双向同步策略
（1）表单 state 作为单一事实源，源码编辑器内容为派生态。
（2）源码编辑时进入“源码优先模式”，解析成功后回写表单 state，并将未知字段放入透传区。
（3）提供“冲突提示”，当源码改动导致某些字段类型不符合 schema 时，阻止保存并显示定位。

4.4 文件读写与状态一致性策略

保证单一配置文件准确落盘
（1）所有写入只能由后端执行，前端不直接访问文件系统。
（2）每次写入都记录写入快照哈希与时间戳，用于 UI 显示与故障定位。
（3）写入失败时不更新 active_profile_id，保持旧配置继续生效。

与 OpenCode 多层配置机制的关系
OpenCode 会合并来自多个来源的配置，并按顺序覆盖冲突键。
因此产品要明确告诉用户当前写入的是“全局层”还是“自定义目录层”，并提示若存在更高优先级来源，例如 inline config 或 managed config，则可能覆盖本次写入的效果。

备份与回滚
（1）默认启用轻量备份，保留最近 N 份。
（2）提供“一键回滚到上一份备份”，回滚同样走原子写入流程。
（3）备份与 Profile 概念分离，备份属于“写入历史”，用于灾备，不参与多方案并发管理的业务概念，避免与需求中强调的“非历史版本控制”混淆。

4.5 安全与隐私

本地优先
Profile，统计，日志默认仅保存在本机，不上传云端。

敏感字段处理
识别常见 apiKey 字段并在 UI 里脱敏显示，源码编辑器可选择显示明文或保持脱敏，默认脱敏。导出时可选是否包含敏感字段。

日志
提供本地调试日志开关，默认关闭。日志避免写入敏感字段原文。

五，验收标准与关键用例

Profile 切换原子性
在切换过程中强制杀进程或断电，不应出现 opencode.jsonc 半文件状态。重启后要么旧配置仍在，要么新配置完整落盘。

兼容性
仅 opencode 模式下，不产生 oh-my-opencode.json 写入，不改动 plugin 数组。组合模式下，plugin 数组与扩展配置文件联动正确，符合 oh-my-opencode 的启用与卸载描述。

校验与连通性
保存前语法与 schema 校验生效。激活前连通性检测能正确超时返回，不阻塞 UI。

跨平台
Windows 与 macOS Intel 及 Apple Silicon 安装运行正常，默认路径识别正确，并能正确写入 OpenCode 的全局配置路径。
一，产品概述

背景
OpenCode 采用多层配置加载与合并机制，配置源包含远程 .well-known/opencode，全局 ~/.config/opencode/opencode.json{,c}，环境变量指定的自定义配置，项目内 opencode.json{,c}，以及 .opencode 目录等，并使用 deep merge 语义合并，后加载的来源覆盖冲突键。
Oh My OpenCode 通过插件方式增强 OpenCode，并引入自己的配置文件 oh-my-opencode.json，其用户级默认路径位于 ~/.config/opencode/oh-my-opencode.json，项目级可放在 .opencode/oh-my-opencode.json。

目标用户
面向需要频繁在多供应商，多中转，多模型策略之间切换的开发者与团队，例如供应商 A 与中转商 A，供应商 B 与中转商 B，不同项目使用不同插件组合，不同网络环境使用不同 endpoint。

核心价值
（1）多配置方案并发管理与一键激活，避免手工改文件带来的出错与成本。
（2）单一生效原则保证同一时刻只有一套配置进入 OpenCode 的生效路径，从而让“当前环境”可预期且可追踪。
（3）内置语法校验与连通性检测，在写入前发现错误，降低启动失败与隐性网络问题。
（4）可选的使用统计让用户理解各方案的使用频次与活跃时长，辅助整理与优化。

产品边界与非目标
本产品管理的是配置的编排，落盘与切换，不做 OpenCode 内部会话管理，不接入任何第三方 OAuth 流程，不提供任何伪造签名或绕过机制，遵循上游项目安全与合规告知。

二，功能详细设计

2.1 核心概念与对象模型

Profile（配置方案）
一组可独立激活的配置集合，至少包含：
（1）opencode 主配置内容，文件名 opencode.json 或 opencode.jsonc。OpenCode 支持 JSON 与 JSONC，且会优先尝试加载 .jsonc 再回退到 .json。
（2）可选的 oh-my-opencode 扩展配置内容，文件名 oh-my-opencode.json 或 oh-my-opencode.jsonc（产品内部统一用 JSONC 输出，便于注释与人读）。其默认落点为用户级 ~/.config/opencode/oh-my-opencode.json 或项目级 .opencode/oh-my-opencode.json。
（3）元数据：名称，描述，创建时间，最后激活时间，是否启用统计，标签（如“供应商A”“中转商A”），自定义配置目录选择（可选）。

Active Profile（当前生效方案）
同一时刻唯一。激活意味着将该 Profile 的配置以原子方式写入用户选择的目标配置目录中，并确保插件联动关系正确。

Config Location（配置路径策略）
支持三类路径策略：
（1）默认全局目录。Linux 与 macOS 默认使用 ~/.config/opencode/opencode.json{,c}，Windows 默认使用 %APPDATA%/opencode/opencode.json{,c}。
（2）自定义配置目录，使用 OPENCODE_CONFIG_DIR 指向一个目录，该目录像标准 .opencode 目录一样被搜索，用于 agents，commands，modes，plugins 等资源，并在全局与 .opencode 目录之后加载，具备覆盖能力。
（3）自定义配置文件路径，使用 OPENCODE_CONFIG 指向单文件。
本产品重点管理“用户全局目录”与“自定义配置目录”，同时允许用户在界面上切换目标路径策略。

2.2 多配置方案管理（Profile Management）

列表视图与快速切换
（1）左侧或顶部为 Profile 列表，展示名称，标签，最近激活时间，统计开关状态，健康状态（语法，连通性）。
（2）每个 Profile 提供“激活”按钮。激活后该条目呈现明显的 Active 视觉态，并显示“生效路径”与“写入时间”。
（3）切换要求原子性：新配置写入完成且 fsync 成功后，再完成指针切换，避免中间态导致 OpenCode 读到半写入文件。

CRUD
（1）创建：支持从模板创建，复制现有 Profile，或从当前磁盘配置导入。导入时读取目标目录的 opencode.json{,c}，并检测是否存在 oh-my-opencode.json。
（2）查看与编辑：进入编辑页支持双模编辑与校验。
（3）删除：仅删除本软件内的 Profile 数据，不主动删除用户磁盘上的现有配置文件。若要清理磁盘文件，提供单独的“清理向导”，默认关闭，避免误删。

单一生效原则与互斥逻辑
（1）系统持久化多个 Profile。
（2）激活时写入目标目录的实际配置文件。
（3）系统保存一个 active_profile_id，并记录激活事件。
（4）再次激活另一个 Profile 时，先完成新配置写入，再更新 active 指针，再记录旧 Profile 的“本次活跃区间结束”。

兼容性模式
（1）仅 opencode 模式：Profile 只管理 opencode.json{,c}，不写入 oh-my-opencode.json，同时在主配置内不强制插入插件条目。
（2）组合模式：启用 oh-my-opencode 时，必须满足两点：
A. 主配置的 plugin 数组包含 "oh-my-opencode"。在 oh-my-opencode 的卸载指引里，明确通过从 plugin 数组移除该项来禁用插件。
B. 写入对应的 oh-my-opencode.json 到用户级或项目级约定路径。
（3）联动策略：
A. 用户在 UI 中打开“启用 oh-my-opencode”开关时，系统自动在主配置中维护 plugin 数组的包含关系。
B. 用户关闭开关时，系统从 plugin 数组移除 "oh-my-opencode"，并停止写入扩展配置文件。扩展配置文件本身是否删除由用户在清理向导中决定。

2.3 双模编辑（Dual-View Editing）

可视化编辑
（1）基于 Schema 的表单渲染。OpenCode 文档指出配置 schema 定义在 opencode.ai/config.json，编辑器可据此验证与自动补全。
（2）提供常用字段的 GUI，例如 theme，provider/model，server 配置，tools 权限开关，tui 参数等，均来自官方配置文档。
（3）对于 schema 中不常用或未知字段，提供“高级字段”以 JSON Tree 形式编辑。

源码编辑
（1）下方常驻一个代码编辑器（Monaco 或 CodeMirror），展示该 Profile 当前生成的 JSONC。
（2）两向同步：
A. GUI 改动后即时更新源码视图，保持格式化与注释策略一致。
B. 源码改动后进行增量解析与校验，通过后反向更新表单状态。
（3）冲突处理：当源码包含 GUI 不支持的字段时，GUI 保留未知字段的“透传区”，保存时不丢失。

校验逻辑与触发时机
（1）语法校验：每次源码编辑停止输入 500ms 后触发，保存前必触发。JSONC 使用支持注释与 trailing comma 的解析器策略以对齐上游行为。
（2）Schema 校验：保存前触发，必要时在用户开启“严格模式”后改为实时触发。
（3）连通性检测 Connectivity Check：
A. 在保存后自动触发一次，可在设置中关闭自动触发。
B. 在激活前强制触发一次，若失败给出二次确认选项，允许用户仍然激活。
C. 检测目标来源：从配置中提取 URL 或服务地址字段，至少覆盖 provider endpoint 类字段与 mcp remote url 类字段。OpenCode 文档示例中出现远程 .well-known/opencode 以及 mcp remote url 的结构。
D. 异步与超时：每个 URL 单独超时，例如 3 秒，整体并发上限例如 10，避免阻塞 UI。

2.4 路径管理

默认路径
默认指向全局配置目录。Linux 与 macOS 为 ~/.config/opencode/opencode.json{,c}，Windows 为 %APPDATA%/opencode/opencode.json{,c}。

自定义路径切换
（1）支持选择一个目录作为“目标写入目录”。
（2）支持一键切换为 OPENCODE_CONFIG_DIR 模式，软件将帮助用户在启动 opencode 时注入该环境变量的推荐方式，并在应用内保存该模式。该变量的行为与加载顺序在官方文档中有明确描述。
（3）对 Windows 与 macOS 需要提供路径校验与权限提示，尤其是 ProgramData 或系统目录。OpenCode 还存在 managed config 路径如 /etc/opencode 与 C:\ProgramData\opencode，产品默认不写入这些受管路径，仅识别并提示其优先级更高。

多路径并存策略
用户可以保存多个“目标路径配置”，每次激活 Profile 时选择写入到哪个目标路径。常见用法是“个人全局”与“工作全局”两个目录切换。

2.5 使用统计（Usage Stats）

开关与范围
（1）统计默认关闭，按 Profile 单独开启。
（2）只记录与本软件相关的切换与活跃区间，不采集代码内容，不采集模型请求信息。

指标定义
（1）切换频次：激活次数，最近 7 天，30 天。
（2）活跃时长：Profile 处于 Active 状态的累计时长，从激活到下一次切换之间计时。若用户关机或应用被强制退出，采用“最后心跳时间”修正，避免无限延长。
（3）健康率：近 N 次连通性检测成功率。

存储方式
（1）本地 SQLite，表结构包含 profiles，activation_events，connectivity_results，settings。
（2）所有统计数据可一键导出为 JSON，便于用户自检。
（3）提供“一键清空统计”的隐私控制。

2.6 多语言 i18n

范围
简体中文默认，繁体中文，英文，并支持应用内实时切换。

设计要点
（1）字符串资源与 UI 文案分离。
（2）日期，数字，单位本地化。
（3）校验错误信息分级展示，先给用户可读摘要，再提供原始错误详情。

三，UI/UX 设计理念

总体风格
现代，简洁，强调“当前生效方案”的清晰度与切换反馈。参考同类配置切换桌面工具的清爽列表与一键切换心智，例如 cockpit-tools 强调一键切换与多语言支持。

信息架构建议
（1）左侧导航三项：Profiles，Path & Env，Settings。
（2）Profiles 页分为左右两栏：左侧 Profile 列表，右侧详情与编辑。
（3）详情区顶部为状态条：Active 标识，写入路径，最近校验结果。中部为可视化表单。底部为源码编辑器与校验面板。

Profile 列表的关键交互
（1）Active 视觉区分：高对比但不刺眼的高亮背景，带“Active”徽标与生效路径摘要。
（2）一键切换：点击激活后立刻进入“切换中”状态，显示步骤进度：校验，连通性检测，写入，完成。
（3）失败反馈：明确失败发生在哪一步，并提供“查看详情日志”入口。
（4）危险操作：删除与清理分离，删除只影响软件内部数据，清理向导需要二次确认。

双模编辑体验
（1）GUI 与源码同屏，减少在不同页之间跳转。
（2）源码编辑器的错误标注与表单字段联动，高亮出错字段。
（3）提供“格式化 JSONC”“从 Schema 补全缺省字段”“恢复到上次保存”三个快捷动作。

设置页建议
（1）语言切换。
（2）校验策略：是否自动连通性检测，超时阈值，并发上限。
（3）统计隐私：默认关闭，提供全局开关与清空按钮。
（4）写入策略：是否自动备份旧配置，备份保留数量。

四，技术架构方案

4.1 技术选型

桌面框架
推荐 Tauri。理由是 Rust 后端与系统能力天然契合，包体积与性能较优，且能覆盖 Windows 与 macOS Intel 及 Apple Silicon 的发行形态。

前端框架
推荐 React + TypeScript + Vite。理由：
（1）生态成熟，表单与代码编辑器组件选择丰富，Schema 驱动表单可用成熟方案。
（2）适合做复杂状态管理与双向同步。
UI 组件建议使用 shadcn/ui 或 Radix 体系，配合 Tailwind 实现现代简洁风格。状态管理建议 Zustand 或 Jotai。i18n 建议 i18next。

Rust 依赖建议
（1）配置解析：支持 JSONC 的解析方案，或引入兼容注释的 JSONC 解析库，保证与 OpenCode 的 JSONC 特性一致。
（2）网络探测：reqwest + tokio，支持并发与超时。
（3）存储：rusqlite 或 sqlx。
（4）文件原子写：tempfile + 原子 rename + fsync。

4.2 后端 Rust 模块设计

Core Domain
（1）profile_service
职责：Profile CRUD，导入导出，schema 校验入口，激活互斥控制。
关键接口：create_profile，update_profile，delete_profile，activate_profile，get_active_profile。

（2）config_render
职责：将 UI 表单状态渲染为 JSONC 文本，维持字段顺序与注释策略，可插入 $schema 字段用于编辑器提示。官方示例配置包含 $schema 指向 https://opencode.ai/config.json。

（3）config_writer
职责：将渲染后的 opencode 与 oh-my-opencode 配置写入正确路径，并保证原子性。
原子写入流程建议：
A. 计算目标文件路径，例如 <target_dir>/opencode.jsonc，以及扩展配置 <target_dir>/oh-my-opencode.json。
B. 写入临时文件到同目录，例如 opencode.jsonc.tmp。
C. flush 并 fsync 临时文件。
D. 如开启备份，先将旧文件 rename 为带时间戳的备份名，再 fsync 目录。
E. 将 tmp 原子 rename 为正式文件名，再 fsync 目录。
F. 返回写入成功事件。
说明：rename 在同一文件系统内具备原子替换语义，可避免半写入被读取。

（4）compat_service
职责：组合模式联动处理。
A. 当 Profile 启用 oh-my-opencode，确保主配置 plugin 数组包含 "oh-my-opencode"。
B. 当关闭时，移除该项并停止写入扩展配置文件。
C. 同时识别项目级 .opencode/oh-my-opencode.json 的存在并提示用户当前写入的是用户级还是项目级。

（5）connectivity_checker
职责：从配置中抽取 URL，执行异步探测。
实现要点：
A. 解析配置 JSON 为 Value，按白名单路径抽取常见 endpoint 字段。
B. HEAD 优先，若服务不支持 HEAD 则回退 GET，避免误判。
C. 超时与并发控制。
D. 结果落库，并返回给前端做健康提示。

（6）stats_service
职责：统计事件记录与聚合。
A. activation_event 写入。
B. active duration 通过后台定时心跳或前端事件驱动写入最后活跃时间。
C. 提供按 Profile 的聚合查询接口。

数据流向

激活流程的数据流建议如下：
前端点击激活，后端收到 activate_profile(profile_id, target_path_mode)。
后端执行 schema 校验与语法校验。
后端执行连通性检测并返回结果，如失败按策略中断或允许继续。
后端执行 config_writer 原子写入。
后端更新 active_profile_id 与写入 activation_event。
前端刷新列表 Active 状态与提示条。

4.3 前端模块与状态管理

页面与组件
（1）ProfileList：列表，搜索，标签过滤，排序。
（2）ProfileDetail：状态条，表单编辑，源码编辑，校验面板，统计面板。
（3）PathManager：管理默认目录，自定义目录，OPENCODE_CONFIG_DIR 引导。官方明确该变量用于指定自定义配置目录，并参与加载顺序。
（4）Settings：语言，校验策略，统计隐私，备份策略。

双向同步策略
（1）表单 state 作为单一事实源，源码编辑器内容为派生态。
（2）源码编辑时进入“源码优先模式”，解析成功后回写表单 state，并将未知字段放入透传区。
（3）提供“冲突提示”，当源码改动导致某些字段类型不符合 schema 时，阻止保存并显示定位。

4.4 文件读写与状态一致性策略

保证单一配置文件准确落盘
（1）所有写入只能由后端执行，前端不直接访问文件系统。
（2）每次写入都记录写入快照哈希与时间戳，用于 UI 显示与故障定位。
（3）写入失败时不更新 active_profile_id，保持旧配置继续生效。

与 OpenCode 多层配置机制的关系
OpenCode 会合并来自多个来源的配置，并按顺序覆盖冲突键。
因此产品要明确告诉用户当前写入的是“全局层”还是“自定义目录层”，并提示若存在更高优先级来源，例如 inline config 或 managed config，则可能覆盖本次写入的效果。

备份与回滚
（1）默认启用轻量备份，保留最近 N 份。
（2）提供“一键回滚到上一份备份”，回滚同样走原子写入流程。
（3）备份与 Profile 概念分离，备份属于“写入历史”，用于灾备，不参与多方案并发管理的业务概念，避免与需求中强调的“非历史版本控制”混淆。

4.5 安全与隐私

本地优先
Profile，统计，日志默认仅保存在本机，不上传云端。

敏感字段处理
识别常见 apiKey 字段并在 UI 里脱敏显示，源码编辑器可选择显示明文或保持脱敏，默认脱敏。导出时可选是否包含敏感字段。

日志
提供本地调试日志开关，默认关闭。日志避免写入敏感字段原文。

五，验收标准与关键用例

Profile 切换原子性
在切换过程中强制杀进程或断电，不应出现 opencode.jsonc 半文件状态。重启后要么旧配置仍在，要么新配置完整落盘。

兼容性
仅 opencode 模式下，不产生 oh-my-opencode.json 写入，不改动 plugin 数组。组合模式下，plugin 数组与扩展配置文件联动正确，符合 oh-my-opencode 的启用与卸载描述。

校验与连通性
保存前语法与 schema 校验生效。激活前连通性检测能正确超时返回，不阻塞 UI。

跨平台
Windows 与 macOS Intel 及 Apple Silicon 安装运行正常，默认路径识别正确，并能正确写入 OpenCode 的全局配置路径。