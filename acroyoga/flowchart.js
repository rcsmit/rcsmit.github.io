const svg = document.getElementById("chart");
const viewGroup = document.getElementById("viewGroup");
const tooltip = document.getElementById("tooltip");
const popup = document.getElementById("popup");

const categoryColors = {
  static: "#e0f7fa",
  transition: "#fff3e0",
  washing_machine: "#fce4ec",
  default: "#eeeeee",
  pose: "#eeeeee",
  start: "#00ff00",
  entry_exit: "#00dddd"
};

const categoryShapes = {
  static: "rect",
  transition: "circle",
  washing_machine: "diamond",
  default: "rect",
  pose: "rect",
  start: "circle",
  entry_exit: "circle",
};

document.getElementById("zoom-in").onclick = () => zoom(0.9);
document.getElementById("zoom-out").onclick = () => zoom(1.1);
document.getElementById("home").onclick = () => {
  viewBox = { x: 0, y: 0, w: 1200, h: 800 };
  updateViewBox();
};

let viewBox = { x: 0, y: 0, w: 1200, h: 800 };
function updateViewBox() {
  svg.setAttribute("viewBox", `${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`);
}
function zoom(factor) {
  viewBox.w *= factor;
  viewBox.h *= factor;
  updateViewBox();
}
updateViewBox();

let isDragging = false;
let start = null;
svg.addEventListener("mousedown", (e) => {
  isDragging = true;
  start = { x: e.clientX, y: e.clientY };
});
svg.addEventListener("mousemove", (e) => {
  if (!isDragging) return;
  const dx = (e.clientX - start.x) * viewBox.w / svg.clientWidth;
  const dy = (e.clientY - start.y) * viewBox.h / svg.clientHeight;
  viewBox.x -= dx;
  viewBox.y -= dy;
  updateViewBox();
  start = { x: e.clientX, y: e.clientY };
});
svg.addEventListener("mouseup", () => isDragging = false);

const data = {
  nodes: [
  //  {
  //     "id": "PljVGr8iR2YL2gw-_0Ea-7" ,
  //     "info":"loremp ipsum",
  //     "video":"dQw4w9WgXcQ",
  //     "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
  //     "label": "",
  //     "x": 1150,
  //     "y": 1110
  //   },
  //   {
  //     "id": "acroyoga_pose_108" ,
  //     "info":"loremp ipsum",
  //     "video":"dQw4w9WgXcQ",
  //     "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
  //     "label": "",
  //     "x": 34,
  //     "y": 1058
  //   },
  //   {
  //     "id": "acroyoga_pose_104" ,
  //     "info":"loremp ipsum",
  //     "video":"dQw4w9WgXcQ",
  //     "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
  //     "label": "",
  //     "x": 189,
  //     "y": 1080
  //   },
  //   {
  //     "id": "acroyoga_pose_101" ,
  //     "info":"loremp ipsum",
  //     "video":"dQw4w9WgXcQ",
  //     "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
  //     "label": "<b><font style=\"font-size: 14px;\">LEGENDA</font></b>",
  //     "x": 1496,
  //     "y": 780
  //   },
    {
      "id": "acroyoga_pose_x_1" ,
      "info":"loremp ipsum",
      "video":"l2IFcLpEpMY",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "front plank",
      "category":"pose",
      "x": 36,
      "y": 550
    },
    {
      "id": "acroyoga_pose_x_2" ,
      "info":"loremp ipsum",
      "video":"l2IFcLpEpMY",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "front bird",
      "category":"pose",
      "x": 350,
      "y": 550
    },
    {
      "id": "acroyoga_pose_x_5" ,
      "info":"loremp ipsum",
      "video":"2ONOnNAHT4A",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "folded leaf",
      "category":"pose",
      "x": 650,
      "y": 550
    },
    {
      "id": "acroyoga_pose_x_7" ,
      "info":"loremp ipsum",
      "video":"BqUpzbc2uxM",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "straddle throne",
      "category":"pose",
      "x": 530,
      "y": 640
    },
    {
      "id": "acroyoga_pose_x_8" ,
      "info":"loremp ipsum",
      "video":"dollsSxNWzg",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "chair",
      "category":"pose",
      "x": 530,
      "y": 750
    },
    {
      "id": "acroyoga_pose_x_9" ,
      "info":"loremp ipsum",
      "video":"gixLd-6i9ko",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "foot to shin",
      "category":"pose",
      "x": 350,
      "y": 750
    },
    {
      "id": "acroyoga_pose_x_17" ,
      "info":"loremp ipsum",
      "video":"_f7S0rtE0zI",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "couch",
      "category":"pose",
      "x": 720,
      "y": 640
    },
    {
      "id": "acroyoga_pose_x_21" ,
      "info":"loremp ipsum",
      "video":"qTaM5V8o03M",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse straddle throne",
      "category":"pose",
      "x": 890,
      "y": 715
    },
    {
      "id": "acroyoga_pose_x_24" ,
      "info":"loremp ipsum",
      "video":"nn5NCMujhV8",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "shin to foot",
      "category":"pose",
      "x": 36,
      "y": 848
    },
    {
      "id": "acroyoga_pose_x_26" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "flamingo",
      "category":"pose",
      "x": 36,
      "y": 758
    },
    {
      "id": "acroyoga_pose_x_29" ,
      "info":"loremp ipsum",
      "video":"dxY9NK9yMYw",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "maria pose",
      "category":"pose",
      "x": 36,
      "y": 948
    },

    // done until here
    {
      "id": "acroyoga_pose_x_31" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "high flying whale",
      "category":"pose",
      "x": 530,
      "y": 850
    },
    {
      "id": "acroyoga_pose_x_33" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "candle stick / shoulder stand",
      "category":"pose",
      "x": 345,
      "y": 370
    },
    {
      "id": "acroyoga_pose_x_35" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "free shoulder stand",
      "category":"pose",
      "x": 553,
      "y": 370
    },
    {
      "id": "acroyoga_pose_x_40" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "side star",
      "category":"pose",
      "x": 36,
      "y": 655
    },
    {
      "id": "acroyoga_pose_x_42" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "straddle bat",
      "category":"pose",
      "x": 1201,
      "y": 550
    },
    {
      "id": "acroyoga_pose_x_44" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "inside side star <br> ",
      "category":"pose",
      "x": 1201,
      "y": 410
    },
    {
      "id": "acroyoga_pose_x_46" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "inside side star <br> ",
      "category":"pose",
      "x": 1348,
      "y": 490
    },
    {
      "id": "acroyoga_pose_x_48" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse bird <br> ",
      "category":"pose",
      "x": 1488,
      "y": 490
    },
    {
      "id": "acroyoga_pose_x_51" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "floating paschi",
      "category":"pose",
      "x": 1348,
      "y": 680
    },
    {
      "id": "acroyoga_pose_x_55" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "backbird",
      "category":"pose",
      "x": 1302,
      "y": 880
    },
    {
      "id": "acroyoga_pose_x_57" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "back leaf",
      "category":"pose",
      "x": 1202,
      "y": 970
    },
    {
      "id": "acroyoga_pose_x_59" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "boat",
      "category":"pose",
      "x": 1342,
      "y": 970
    },
    {
      "id": "acroyoga_pose_x_63" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "star",
      "category":"pose",
      "x": 900,
      "y": 290
    },
    {
      "id": "acroyoga_pose_y_5" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "handstand in/out (head side) ",
      "category":"entry_exit",
      "x": 1152,
      "y": 870
    },
    {
      "id": "acroyoga_pose_y_8" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "four step",
      "category":"washing_machine",
      "x": 900,
      "y": 190
    },
    {
      "id": "acroyoga_pose_y_15" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "cartwheel in",
      "category":"pose",
      "x": 1201,
      "y": 290
    },
    {
      "id": "acroyoga_pose_y_17" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "low barrel rol",
      "category":"pose",
      "x": 809,
      "y": 480
    },
    {
      "id": "acroyoga_pose_y_23" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "helicopter",
      "category":"transition",
      "x": 720,
      "y": 370
    },
    {
      "id": "acroyoga_pose_y_27" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "catherinas wheel",
      "category":"washing_machine",
      "x": 433,
      "y": 460
    },
    {
      "id": "acroyoga_pose_y_30" ,
      "info":"loremp ipsum",
      "video":"aO9-OqnAeDk",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "monkey frog",
      "category":"pose",
      "x": 980,
      "y": 850
    },
    {
      "id": "acroyoga_pose_y_33" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "corkscrew",
      "category":"transition",
      "x": 719,
      "y": 290
    },
    {
      "id": "acroyoga_pose_y_37" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "ACROYOGA L-BASING",
      "category":"pose",
      "x": 367,
      "y": 55
    },
    {
      "id": "acroyoga_pose_y_39" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "entry / exit",
      "category":"entry_exit",
      "x": 1510,
      "y": 820
    },
    {
      "id": "acroyoga_pose_y_40" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "pose",
      "category":"pose",
      "x": 1510,
      "y": 913
    },
    {
      "id": "acroyoga_pose_y_41" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "washing machine",
      "category":"washing_machine",
      "x": 1510,
      "y": 1080
    },
    {
      "id": "acroyoga_pose_3" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "bed / couch",
      "category":"pose",
      "x": 396,
      "y": 950
    },
    {
      "id": "acroyoga_pose_8" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse foot to hand",
      "category":"pose",
      "x": 265,
      "y": 950
    },
    {
      "id": "acroyoga_pose_10" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse star",
      "category":"pose",
      "x": 659,
      "y": 950
    },
    {
      "id": "acroyoga_pose_11" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "bird on hand",
      "category":"pose",
      "x": 940,
      "y": 950
    },
    {
      "id": "acroyoga_pose_17" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse shoulderstand",
      "category":"pose",
      "x": 839,
      "y": 850
    },
    {
      "id": "acroyoga_pose_19" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "thinker",
      "category":"pose",
      "x": 700,
      "y": 850
    },
    {
      "id": "acroyoga_pose_28" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "around the world",
      "category":"pose",
      "x": 721,
      "y": 720
    },
    {
      "id": "acroyoga_pose_36" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "biceps stand",
      "category":"pose",
      "x": 552,
      "y": 260
    },
    {
      "id": "acroyoga_pose_37" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "crocodile",
      "category":"pose",
      "x": 552,
      "y": 170
    },
    {
      "id": "acroyoga_pose_38" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "foot to hand",
      "category":"pose",
      "x": 720,
      "y": 170
    },
    {
      "id": "acroyoga_pose_45" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "bow",
      "category":"pose",
      "x": 390,
      "y": 640
    },
    {
      "id": "acroyoga_pose_49" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "foot to hand",
      "category":"pose",
      "x": 1020,
      "y": 680
    },
    {
      "id": "acroyoga_pose_50" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse bird",
      "category":"pose",
      "x": 1160,
      "y": 680
    },
    {
      "id": "acroyoga_pose_60" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "handstand in/out (legs side)",
      "category":"pose",
      "x": 340,
      "y": 840
    },
    {
      "id": "acroyoga_pose_61" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "trapdoor",
      "category":"pose",
      "x": 1252,
      "y": 770
    },
    {
      "id": "acroyoga_pose_64" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse foot to shin",
      "category":"pose",
      "x": 527,
      "y": 1090
    },
    {
      "id": "acroyoga_pose_66" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "tuck sit",
      "category":"pose",
      "x": 264,
      "y": 1090
    },
    {
      "id": "acroyoga_pose_67" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "revese shin to foot",
      "category":"pose",
      "x": 396,
      "y": 1090
    },
    {
      "id": "acroyoga_pose_68" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse star",
      "category":"pose",
      "x": 345,
      "y": 260
    },
    {
      "id": "acroyoga_pose_69" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "reverse back plank",
      "category":"pose",
      "x": 530,
      "y": 950
    },
    {
      "id": "acroyoga_pose_72" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "(reverse) foot to foot ",
      "category":"pose",
      "x": 659,
      "y": 1090
    },
    {
      "id": "acroyoga_pose_73" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "(baby) (reverse)&nbsp; hand to hand ",
      "category":"pose",
      "x": 791,
      "y": 1090
    },
    {
      "id": "acroyoga_pose_82" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": " waterfall to chair&nbsp;  or  rev. feet to hand ",
      "category":"pose",
      "x": 200,
      "y": 260
    },
    {
      "id": "acroyoga_pose_85" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "Rene Smit @rcsmit  CC BY-NC 4.0 ",
      "category":"pose",
      "x": 41,
      "y": 1105
    },
    {
      "id": "acroyoga_pose_87" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "koala queen",
      "category":"pose",
      "x": 1060,
      "y": 190
    },
    {
      "id": "acroyoga_pose_88" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "spider roll",
      "category":"pose",
      "x": 1040,
      "y": 290
    },
    {
      "id": "acroyoga_pose_93" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "START",
      "category":"start",
      "x": 36,
      "y": 430
    },
    {
      "id": "acroyoga_pose_96" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "transition",
      "category":"transition",
      "x": 1510,
      "y": 997
    },
    {
      "id": "acroyoga_pose_97" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "Extra poses:",
      "category":"pose",
      "x": 204,
      "y": 1105
    },
    {
      "id": "acroyoga_pose_99" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "crunch roll",
      "category":"pose",
      "x": 1111,
      "y": 770
    },
    {
      "id": "acroyoga_pose_106" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "rotisserie",
      "category":"pose",
      "x": 1356,
      "y": 380
    },
    {
      "id": "acroyoga_pose_110" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "bird on hands",
      "category":"pose",
      "x": 210,
      "y": 460
    },
    {
      "id": "acroyoga_pose_z_2" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "ballerina",
      "category":"pose",
      "x": 180,
      "y": 611
    },
    {
      "id": "acroyoga_pose_z_5" ,
      "info":"loremp ipsum",
      "video":"jbtQWzQ3v7g",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "big le moi",
      "category":"pose",
      "x": 174,
      "y": 691
    },
    {
      "id": "acroyoga_pose_117" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "mermaid",
      "category":"pose",
      "x": 791,
      "y": 950
    },
    {
      "id": "acroyoga_pose_119" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "high barrel roll",
      "category":"pose",
      "x": 1201,
      "y": 190
    },
    {
      "id": "acroyoga_pose_z_8" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "jump in",
      "category":"pose",
      "x": 345,
      "y": 160
    },
    {
      "id": "acroyoga_pose_121" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "barrel roll",
      "category":"pose",
      "x": 1348,
      "y": 570
    },
    {
      "id": "acroyoga_pose_123" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "buddha roll",
      "category":"pose",
      "x": 1040,
      "y": 610
    },
    {
      "id": "PljVGr8iR2YL2gw-_0Ea-3" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "table top",
      "category":"pose",
      "x": 952,
      "y": 561
    },
    {
      "id": "acroyoga_pose_z_1" ,
      "info":"loremp ipsum",
      "video":"dQw4w9WgXcQ",
      "photo":"C:\\Users\\rcxsm\\Downloads\\unnamed.jpg",
      "label": "prasarita twist",
      "category":"pose",
      "x": 810,
      "y": 549
    },
    
], 
edges : [
  {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_y_33"
    },
    {
      "source": "acroyoga_pose_x_31",
      "target": "acroyoga_pose_69"
    },
    {
      "source": "acroyoga_pose_x_1",
      "target": "acroyoga_pose_x_2"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_x_5"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_x_7"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_x_33"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_x_33"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_x_33"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_x_33"
    },
    {
      "source": "acroyoga_pose_x_1",
      "target": "acroyoga_pose_x_40"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_y_17"
    },
    {
      "source": "acroyoga_pose_x_2",
      "target": "acroyoga_pose_110"
    },
    {
      "source": "acroyoga_pose_x_7",
      "target": "acroyoga_pose_x_8"
    },
    {
      "source": "acroyoga_pose_x_7",
      "target": "acroyoga_pose_x_17"
    },
    {
      "source": "acroyoga_pose_x_7",
      "target": "acroyoga_pose_x_17"
    },
    {
      "source": "acroyoga_pose_x_7",
      "target": "acroyoga_pose_28"
    },
    {
      "source": "acroyoga_pose_x_8",
      "target": "acroyoga_pose_x_9"
    },
    {
      "source": "acroyoga_pose_x_8",
      "target": "acroyoga_pose_x_31"
    },
    {
      "source": "acroyoga_pose_x_9",
      "target": "acroyoga_pose_x_24"
    },
    {
      "source": "acroyoga_pose_x_21",
      "target": "acroyoga_pose_y_30"
    },
    {
      "source": "acroyoga_pose_x_21",
      "target": "acroyoga_pose_17"
    },
    {
      "source": "acroyoga_pose_x_21",
      "target": "acroyoga_pose_19"
    },
    {
      "source": "acroyoga_pose_x_21",
      "target": "acroyoga_pose_49"
    },
    {
      "source": "acroyoga_pose_x_21",
      "target": "acroyoga_pose_123"
    },
    {
      "source": "acroyoga_pose_x_24",
      "target": "acroyoga_pose_x_26"
    },
    {
      "source": "acroyoga_pose_x_24",
      "target": "acroyoga_pose_x_26"
    },
    {
      "source": "acroyoga_pose_x_24",
      "target": "acroyoga_pose_x_29"
    },
    {
      "source": "acroyoga_pose_x_31",
      "target": "acroyoga_pose_3"
    },
    {
      "source": "acroyoga_pose_x_31",
      "target": "acroyoga_pose_8"
    },
    {
      "source": "acroyoga_pose_x_31",
      "target": "acroyoga_pose_10"
    },
    {
      "source": "acroyoga_pose_x_33",
      "target": "acroyoga_pose_x_35"
    },
    {
      "source": "acroyoga_pose_x_35",
      "target": "acroyoga_pose_y_23"
    },
    {
      "source": "acroyoga_pose_x_35",
      "target": "acroyoga_pose_36"
    },
    {
      "source": "acroyoga_pose_x_44",
      "target": "acroyoga_pose_x_42"
    },
    {
      "source": "acroyoga_pose_x_42",
      "target": "acroyoga_pose_x_46"
    },
    {
      "source": "acroyoga_pose_x_42",
      "target": "acroyoga_pose_x_51"
    },
    {
      "source": "acroyoga_pose_123",
      "target": "acroyoga_pose_x_42"
    },
    {
      "source": "acroyoga_pose_x_63",
      "target": "acroyoga_pose_x_42"
    },
    {
      "source": "acroyoga_pose_x_42",
      "target": "acroyoga_pose_121"
    },
    {
      "source": "acroyoga_pose_y_15",
      "target": "acroyoga_pose_x_44"
    },
    {
      "source": "acroyoga_pose_x_44",
      "target": "acroyoga_pose_106"
    },
    {
      "source": "acroyoga_pose_x_46",
      "target": "acroyoga_pose_x_48"
    },
    {
      "source": "acroyoga_pose_x_48",
      "target": "acroyoga_pose_x_44"
    },
    {
      "source": "acroyoga_pose_x_55",
      "target": "acroyoga_pose_x_57"
    },
    {
      "source": "acroyoga_pose_x_55",
      "target": "acroyoga_pose_x_59"
    },
    {
      "source": "acroyoga_pose_x_55",
      "target": "acroyoga_pose_y_5"
    },
    {
      "source": "acroyoga_pose_x_63",
      "target": "acroyoga_pose_y_8"
    },
    {
      "source": "acroyoga_pose_x_63",
      "target": "acroyoga_pose_87"
    },
    {
      "source": "acroyoga_pose_x_63",
      "target": "acroyoga_pose_88"
    },
    {
      "source": "acroyoga_pose_x_63",
      "target": "acroyoga_pose_119"
    },
    {
      "source": "acroyoga_pose_y_5",
      "target": "acroyoga_pose_x_55"
    },
    {
      "source": "acroyoga_pose_y_17",
      "target": "acroyoga_pose_x_42"
    },
    {
      "source": "acroyoga_pose_y_23",
      "target": "acroyoga_pose_x_42"
    },
    {
      "source": "acroyoga_pose_y_33",
      "target": "acroyoga_pose_x_63"
    },
    {
      "source": "acroyoga_pose_17",
      "target": "acroyoga_pose_50"
    },
    {
      "source": "acroyoga_pose_28",
      "target": "acroyoga_pose_x_21"
    },
    {
      "source": "acroyoga_pose_36",
      "target": "acroyoga_pose_37"
    },
    {
      "source": "acroyoga_pose_37",
      "target": "acroyoga_pose_38"
    },
    {
      "source": "acroyoga_pose_38",
      "target": "acroyoga_pose_x_63"
    },
    {
      "source": "acroyoga_pose_60",
      "target": "acroyoga_pose_x_31"
    },
    {
      "source": "acroyoga_pose_49",
      "target": "acroyoga_pose_50"
    },
    {
      "source": "acroyoga_pose_50",
      "target": "acroyoga_pose_61"
    },
    {
      "source": "acroyoga_pose_61",
      "target": "acroyoga_pose_x_55"
    },
    {
      "source": "acroyoga_pose_68",
      "target": "acroyoga_pose_x_33"
    },
    {
      "source": "acroyoga_pose_68",
      "target": "acroyoga_pose_36"
    },
    {
      "source": "acroyoga_pose_68",
      "target": "acroyoga_pose_82"
    },
    {
      "source": "acroyoga_pose_93",
      "target": "acroyoga_pose_x_1"
    },
    {
      "source": "acroyoga_pose_50",
      "target": "acroyoga_pose_99"
    },
    {
      "source": "acroyoga_pose_x_42",
      "target": "acroyoga_pose_49"
    },
    {
      "source": "acroyoga_pose_117",
      "target": "acroyoga_pose_11"
    },
    {
      "source": "acroyoga_pose_x_40",
      "target": "acroyoga_pose_z_5"
    },
    {
      "source": "acroyoga_pose_z_8",
      "target": "acroyoga_pose_68"
    },
    {
      "source": "acroyoga_pose_x_21",
      "target": "acroyoga_pose_x_63"
    },
    {
      "source": "acroyoga_pose_x_5",
      "target": "acroyoga_pose_z_1"
    },
   {
      "source": "acroyoga_pose_x_42",
      "target": "acroyoga_pose_z_1"
    }]
};

// =======================

drawFlowchart(data.nodes, data.edges);

function drawFlowchart(nodes, links) {
  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.innerHTML = `
    <marker id="arrow" markerWidth="10" markerHeight="10" refX="10" refY="5"
      orient="auto" markerUnits="strokeWidth">
      <path d="M0,0 L10,5 L0,10" fill="#aaa" />
    </marker>`;
  svg.appendChild(defs);

  links.forEach(link => {
    const s = nodes.find(n => n.id === link.source);
    const t = nodes.find(n => n.id === link.target);
    if (!s || !t) return;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", s.x);
    line.setAttribute("y1", s.y);
    line.setAttribute("x2", t.x);
    line.setAttribute("y2", t.y);
    line.setAttribute("stroke", "#aaa");
    line.setAttribute("stroke-width", "2");
    //line.setAttribute("marker-end", "url(#arrow)");
    viewGroup.appendChild(line);
  });

  nodes.forEach(node => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    g.classList.add("node");

    // const rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    // rect.setAttribute("x", -50);
    // rect.setAttribute("y", -15);
    // rect.setAttribute("width", 100);
    // rect.setAttribute("height", 30);
    // const fillColor = categoryColors[node.category] || categoryColors.default;
    // rect.setAttribute("fill", fillColor);

    // rect.setAttribute("stroke", "#333");
    // g.appendChild(rect);
    const shapeType = categoryShapes[node.category] || categoryShapes.default;
    const fillColor = categoryColors[node.category] || categoryColors.default;

    let shape;

    if (shapeType === "circle") {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      shape.setAttribute("cx", 0);
      shape.setAttribute("cy", 0);
      shape.setAttribute("r", 20);
    } else if (shapeType === "diamond") {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      shape.setAttribute("points", "0,-20 20,0 0,20 -20,0");
    } else {
      shape = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      shape.setAttribute("x", -50);
      shape.setAttribute("y", -15);
      shape.setAttribute("width", 100);
      shape.setAttribute("height", 30);
    }

    shape.setAttribute("fill", fillColor);
    shape.setAttribute("stroke", "#333");
    g.appendChild(shape);

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dy", "5");
    text.textContent = node.label;
    g.appendChild(text);

    g.addEventListener("mouseover", (e) => {
      tooltip.textContent = node.label;
      tooltip.style.visibility = "visible";
      tooltip.style.left = e.pageX + 10 + "px";
      tooltip.style.top = e.pageY + 10 + "px";
    });

    g.addEventListener("mousemove", (e) => {
      tooltip.style.left = e.pageX + 10 + "px";
      tooltip.style.top = e.pageY + 10 + "px";
    });

    g.addEventListener("mouseleave", () => {
      tooltip.style.visibility = "hidden";
    });


    g.addEventListener("click", (e) => {
        popup.innerHTML = `
        <h3>${node.label}</h3>
        ${node.id}<br>
        <iframe width="280" height="157" src="https://www.youtube.com/embed/${node.video}?si=EJNPiLa76TiQBHXK" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
      `;
        

        
        // Temporarily show popup to measure it
        popup.style.display = "block";
        popup.style.visibility = "hidden";

        const popupWidth = popup.offsetWidth;
        const popupHeight = popup.offsetHeight;
        const margin = 15;

        // Calculate position
        let left = e.pageX + margin;
        let top = e.pageY + margin;

        if (left + popupWidth > window.innerWidth) {
          left = e.pageX - popupWidth - margin;
        }
        if (top + popupHeight > window.innerHeight) {
          top = e.pageY - popupHeight - margin;
        }

        // Set position
        popup.style.left = `${left}px`;
        popup.style.top = `${top}px`;
        popup.style.visibility = "visible";
      });
            


    // g.addEventListener("click", () => {
    //   popup.innerHTML = `
    //     <h3>${node.label}</h3>
    //     <p>${node.label}.</p>
    //     <p><img src=${node.photo} width="280"></p>

    //     <iframe width="280" height="157" src="https://www.youtube.com/embed/${node.video}?si=EJNPiLa76TiQBHXK" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>
    //   `;
    //   popup.style.display = "block";
    // });

    viewGroup.appendChild(g);
  });
}

svg.addEventListener("click", (e) => {
  if (!e.target.closest("g")) {
    popup.style.display = "none";
  }
});

