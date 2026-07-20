/* ----

# Pio SDK 2/3/4 support
# By: jupiterbjy
# Modify: journey-ad
# Last Update: 2021.5.4

To use this, you need to include following sources to your HTML file first.
With this script, you don't have to include `l2d.js`. Testing is done without it.
Basic usage is same with Paul-Pio.

Make sure to call `pio_refresh_style()` upon changing styles on anything related to 'pio-container' and it's children.

To change alignment, modify variable `pio_alignment` to either `left` or `right`, then call `pio_refresh_style()`.

<script src="https://cubism.live2d.com/sdk-web/cubismcore/live2dcubismcore.min.js"></script>
<script src="https://cdn.jsdelivr.net/gh/dylanNew/live2d/webgl/Live2D/lib/live2d.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi.js@5.3.6/dist/pixi.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/pixi-live2d-display/dist/index.min.js"></script>

If you have trouble setting up this, check following example's sources.
https://jupiterbjy.github.io/PaulPio_PIXI_Demo/

---- */

// ========== 修复夜间模式按钮 ==========
// 定义全局 toggleNightMode 函数，供看板娘调用
window.toggleNightMode = function() {
    var darkBtn = document.getElementById('fabtn_toggle_darkmode');
    if (darkBtn) {
        darkBtn.click();
    } else {
        // 降级方案：尝试通过 class 切换
        if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
            document.documentElement.classList.remove('dark');
        } else {
            document.body.classList.add('dark');
            document.documentElement.classList.add('dark');
        }
    }
};

// 监听并修复夜间按钮的点击事件
(function() {
    var originalLoad = window.loadlive2d;
    window.loadlive2d = function(canvas_id, json_object_or_url, on_load) {
        // 延迟修复夜间按钮
        setTimeout(function() {
            var checkInterval = setInterval(function() {
                var nightBtn = document.querySelector('.pio-night');
                if (nightBtn) {
                    clearInterval(checkInterval);
                    // 移除原有事件，绑定新事件
                    var newNightBtn = nightBtn.cloneNode(true);
                    nightBtn.parentNode.replaceChild(newNightBtn, nightBtn);
                    newNightBtn.onclick = function(e) {
                        e.stopPropagation();
                        window.toggleNightMode();
                    };
                    console.log("[Pio] 夜间模式按钮已修复");
                }
            }, 100);
        }, 500);
        
        // 调用原始 loadlive2d 函数
        if (originalLoad) {
            return originalLoad(canvas_id, json_object_or_url, on_load);
        }
    };
})();
// ========== 修复代码结束 ==========

function loadlive2d(canvas_id, json_object_or_url, on_load) {
    // Replaces original l2d method 'loadlive2d' for Pio.
    // Heavily relies on pixi_live2d_display.

    console.log("[Pio] Loading new model")

    const canvas = document.getElementById(canvas_id)

    // When pio was start minimized on browser refresh or reload,
    // canvas is set to 0, 0 dimension and need to be changed.
    if (canvas.width === 0) {
        canvas.removeAttribute("height")
        pio_refresh_style()
    }

    // Try to remove previous model, if any exists.
    try {
        app.stage.removeChildAt(0)
    } catch (error) {

    }

    let model = PIXI.live2d.Live2DModel.fromSync(json_object_or_url)

    model.once("load", () => {
        app.stage.addChild(model)

        const vertical_factor = canvas.height / model.height
        model.scale.set(vertical_factor)

        // match canvas to model width
        canvas.width = model.width
        canvas.height = model.height
        pio_refresh_style()

        // check alignment, and align model to corner
        if (document.getElementsByClassName("pio-container").item(0).className.includes("left")){
            model.x = 30  // 向右偏移，防止左边被裁剪
            canvas.width = model.width + 230  // 左右各预留空间
        } else {
            model.x = 80  // 向右偏移，给左侧头发留空间
            canvas.width = model.width + 160  // 宽画布，左侧预留80px
        }

        // Hit callback definition
        model.on("hit", hitAreas => {
            if (typeof window.pio_onHitArea === "function") {
                window.pio_onHitArea(hitAreas, model);
            } else {
                if (hitAreas.includes("body") || hitAreas.includes("Body")) {
                    model.motion("Tap")
                } else if (hitAreas.includes("head") || hitAreas.includes("Head")){
                    model.expression()
                }
            }
        })
        
        on_load(model)
    })

    return model
}


function _pio_initialize_container(){

    // Generate structure
    let pio_container = document.createElement("div")
    pio_container.classList.add("pio-container")
    pio_container.id = "pio-container"
    document.body.insertAdjacentElement("beforeend", pio_container)

    // Generate action
    let pio_action = document.createElement("div")
    pio_action.classList.add("pio-action")
    pio_container.insertAdjacentElement("beforeend", pio_action)

    // Generate canvas
    let pio_canvas = document.createElement("canvas")
    pio_canvas.id = "pio"
    pio_container.insertAdjacentElement("beforeend", pio_canvas)

    console.log("[Pio] Initialized container.")
}


function pio_refresh_style(){
    // Always make sure to call this after container/canvas style changes!
    // You can set alignment here, but still you can change it manually.

    let pio_container = document.getElementsByClassName("pio-container").item(0)

    pio_container.classList.remove("left", "right")
    pio_container.classList.add(pio_alignment)

    // app.resizeTo = document.getElementById("pio")
}


function _pio_initialize_pixi() {
    // Initialize html elements and pixi app.
    // Must run before pio init.

    _pio_initialize_container()

    app = new PIXI.Application({
        view: document.getElementById("pio"),
        transparent: true,
        autoStart: true,
    })

    pio_refresh_style()
}


// change alignment to left by modifying this value in other script.
// Make sure to call `pio_refresh_style` to apply changes!
let pio_alignment = window.pio_alignment || "right"


let app
window.addEventListener("DOMContentLoaded", _pio_initialize_pixi)