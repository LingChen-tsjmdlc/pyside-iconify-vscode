from pyside_iconify import IconWidget, get_icon, set_icon

# 试用方法（在 F5 弹出的窗口里操作）：
# 1. 在下面某一行的括号里，逗号后面按 Alt+Enter（或 Ctrl+Space），应出现参数列表
# 2. 输入 animation= 之后应出现 "spin" "pulse" 等候选值
# 3. 鼠标停在 IconWidget 或任一参数名上，应出现悬停卡片
# 4. 带 [错误] 的行应有红色波浪线，鼠标停上去看提示
# 5. 光标放在 name= 上按 Ctrl+. ，选"改为 'icon'"一键修复
# 6. 在下面这行的引号里逐个字符输入 mdi 或 mdi:ho，应自动弹出图标候选（需联网），
#    上下键选择，Tab 确认；候选右侧详情面板应显示图标图片
# 7. 任意位置按 Ctrl+Alt+Shift+I 打开图标搜索框

w0 = IconWidget("")

w = IconWidget("mdi:home", )

w2 = IconWidget("mdi:home", animation=)

w3 = IconWidget("mdi:home", opacity=0.5, size="1.5em", hover_color="red")

icon = get_icon("mdi:home", color="blue")

# [错误] 参数名写错：name 应为 icon
bad1 = get_icon(name="mdi:home")

# [错误] 图标名格式不对
bad2 = IconWidget("home")

# [错误] opacity 超出 0 到 1
bad3 = IconWidget("mdi:home", opacity=5)

# [错误] 动画名不存在
bad4 = IconWidget("mdi:home", animation="jump")

# [错误] spin 与另一个动画冲突
bad5 = IconWidget("mdi:home", spin=True, animation="pulse")
