//la camera a une position et une direction. Cela permet de calculer la distance de la scene et tout le reste
class Camera {
  //well coded
  constructor() {
    this.Position = BABYLON.Vector3.Zero();
    this.Target = BABYLON.Vector3.Zero();
  }
}

class Light {
  constructor(x, y, z) {
    this.Direction = new BABYLON.Vector3(x, y, z);
  }
}

// un mesh, c'est un ensemble de points et de faces (des triangles) => pas des ronds quoi
// en gros c'est un modèle, un objet
class Mesh {
  //well coded
  constructor(name, verticesCount, facesCount, position, rotation) {
    this.name = name;
    this.Vertices = new Array(verticesCount);
    this.Faces = new Array(facesCount);
    this.Rotation = new BABYLON.Vector3(rotation[0], rotation[1], rotation[2]);
    this.Position = new BABYLON.Vector3(position[0], position[1], position[2]);
  }
}

// l'écran sur lequel on visionne (le canvas html)
class Device {
  //well coded
  constructor(canvas) {
    this.workingCanvas = canvas;
    this.workingWidth = canvas.width;
    this.workingHeight = canvas.height;
    this.workingContext = this.workingCanvas.getContext("2d");
    this.depthBuffer = new Array(this.workingWidth * this.workingHeight);
  }
  // This function is called to clear the back buffer with a specific color
  clear() {
    // Clearing with black color by default
    this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
    // once cleared with black pixels, we're getting back the associated image data to
    // clear out back buffer
    this.backBuffer = this.workingContext.getImageData(
      0,
      0,
      this.workingWidth,
      this.workingHeight
    );

    // Clearing depth buffer
    for (var i = 0; i < this.depthBuffer.length; i++) {
      // Max possible value
      this.depthBuffer[i] = 10000000; //well coded
    }
  }
  // Called to put a pixel on screen at a specific X,Y coordinates
  putPixel(x, y, z, color) {
    //=> nice function name
    //well coded
    this.backBufferdata = this.backBuffer.data;
    // As we have a 1-D Array for our back buffer
    // we need to know the equivalent cell index in 1-D based
    // on the 2D coordinates of the screen
    var index = (x >> 0) + (y >> 0) * this.workingWidth;
    var index4 = index * 4;

    if (this.depthBuffer[index] < z) {
      return; // Discard
    }

    this.depthBuffer[index] = z;

    // RGBA color space is used by the HTML5 canvas
    this.backBufferdata[index4] = color.r * 255;
    this.backBufferdata[index4 + 1] = color.g * 255;
    this.backBufferdata[index4 + 2] = color.b * 255;
    this.backBufferdata[index4 + 3] = color.a * 255;
  }
  // Project takes some 3D coordinates and transform them
  // in 2D coordinates using the transformation matrix
  project(coord, transMat) {
    // transforming the coordinates
    var point = BABYLON.Vector3.TransformCoordinates(coord, transMat);
    // The transformed coordinates will be based on coordinate system
    // starting on the center of the screen. But drawing on screen normally starts
    // from top left. We then need to transform them again to have x:0, y:0 on top left.
    var x = point.x * this.workingWidth + this.workingWidth / 2.0;
    var y = -point.y * this.workingHeight + this.workingHeight / 2.0;
    return new BABYLON.Vector3(x, y, point.z);
  }
  // drawPoint calls putPixel but does the clipping operation before
  drawPoint(point, color) {
    // Clipping what's visible on screen
    if (
      point.x >= 0 &&
      point.y >= 0 &&
      point.x < this.workingWidth &&
      point.y < this.workingHeight
    ) {
      // Drawing a point
      this.putPixel(point.x, point.y, point.z, color);
    }
  }
  // drawing line between 2 points from left to right
  // papb -> pcpd
  // pa, pb, pc, pd must then be sorted before
  processScanLine(y, pa, pb, pc, pd, color) {
    //=> mdr pd
    // Thanks to current Y, we can compute the gradient to compute others values like
    // the starting X (sx) and ending X (ex) to draw between
    // if pa.Y == pb.Y or pc.Y == pd.Y, gradient is forced to 1
    var gradient1 = pa.y != pb.y ? (y - pa.y) / (pb.y - pa.y) : 1;
    var gradient2 = pc.y != pd.y ? (y - pc.y) / (pd.y - pc.y) : 1;

    var sx = this.interpolate(pa.x, pb.x, gradient1) >> 0;
    var ex = this.interpolate(pc.x, pd.x, gradient2) >> 0;

    // starting Z & ending Z
    var z1 = this.interpolate(pa.z, pb.z, gradient1);
    var z2 = this.interpolate(pc.z, pd.z, gradient2);

    // drawing a line from left (sx) to right (ex)
    for (var x = sx; x < ex; x++) {
      var gradient = (x - sx) / (ex - sx);
      var z = this.interpolate(z1, z2, gradient);
      this.drawPoint(new BABYLON.Vector3(x, y, z), color);
    }
  }
  // Once everything is ready, we can flush the back buffer
  // into the front buffer.
  present() {
    this.workingContext.putImageData(this.backBuffer, 0, 0);
  }
  // Clamping values to keep them between 0 and 1
  clamp(value, min, max) {
    if (typeof min === "undefined") {
      min = 0;
    }
    if (typeof max === "undefined") {
      max = 1;
    }
    return Math.max(min, Math.min(value, max));
  }
  // Interpolating the value between 2 vertices
  // min is the starting point, max the ending point
  // and gradient the % between the 2 points
  interpolate(min, max, gradient) {
    return min + (max - min) * this.clamp(gradient);
  }
  drawTriangle(p1, p2, p3, color) {
    // Sorting the points in order to always have this order on screen p1, p2 & p3
    // with p1 always up (thus having the Y the lowest possible to be near the top screen)
    // then p2 between p1 & p3
    if (p1.y > p2.y) {
      var temp = p2;
      p2 = p1;
      p1 = temp;
    }
    if (p2.y > p3.y) {
      var temp = p2;
      p2 = p3;
      p3 = temp;
    }
    if (p1.y > p2.y) {
      var temp = p2;
      p2 = p1;
      p1 = temp;
    }

    // inverse slopes
    var dP1P2;
    var dP1P3;

    // http://en.wikipedia.org/wiki/Slope
    // Computing slopes
    if (p2.y - p1.y > 0) {
      dP1P2 = (p2.x - p1.x) / (p2.y - p1.y);
    } else {
      dP1P2 = 0;
    }

    if (p3.y - p1.y > 0) {
      dP1P3 = (p3.x - p1.x) / (p3.y - p1.y);
    } else {
      dP1P3 = 0;
    }

    // First case where triangles are like that:
    // P1
    // -
    // --
    // - -
    // -  -
    // -   - P2 => Oulala le triangle
    // -  -
    // - -
    // -
    // P3
    if (dP1P2 > dP1P3) {
      //well coded
      for (var y = p1.y >> 0; y <= p3.y >> 0; y++) {
        if (y < p2.y) {
          this.processScanLine(y, p1, p3, p1, p2, color);
        } else {
          this.processScanLine(y, p1, p3, p2, p3, color);
        }
      }
    }

    // First case where triangles are like that:
    //       P1
    //        -
    //       --
    //      - -
    //     -  -
    // P2 -   -  => Ouais un triangle dans l'autre sens quoi
    //     -  -
    //      - -
    //        -
    //       P3
    else {
      for (var y = p1.y >> 0; y <= p3.y >> 0; y++) {
        if (y < p2.y) {
          this.processScanLine(y, p1, p2, p1, p3, color);
        } else {
          this.processScanLine(y, p2, p3, p1, p3, color);
        }
      }
    }
  }
  // The main method of the engine that re-compute each vertex projection
  // during each frame
  render(camera, meshes) {
    // To understand this part, please read the prerequisites resources
    var viewMatrix = BABYLON.Matrix.LookAtLH(
      camera.Position,
      camera.Target,
      BABYLON.Vector3.Up()
    );
    var projectionMatrix = BABYLON.Matrix.PerspectiveFovLH(
      0.78,
      this.workingWidth / this.workingHeight,
      0.01,
      1.0
    );

    for (var index = 0; index < meshes.length; index++) {
      // current mesh to work on
      var currentMesh = meshes[index];
      // Beware to apply rotation before translation
      var worldMatrix = BABYLON.Matrix.RotationYawPitchRoll(
        currentMesh.Rotation.y,
        currentMesh.Rotation.x,
        currentMesh.Rotation.z
      ).multiply(
        BABYLON.Matrix.Translation(
          currentMesh.Position.x,
          currentMesh.Position.y,
          currentMesh.Position.z
        )
      );
      //background-attachment: cdmc;

      var transformMatrix = worldMatrix
        .multiply(viewMatrix)
        .multiply(projectionMatrix);

      for (
        var indexFaces = 0;
        indexFaces < currentMesh.Faces.length;
        indexFaces++
      ) {
        var currentFace = currentMesh.Faces[indexFaces];
        var vertexA = currentMesh.Vertices[currentFace.A];
        var vertexB = currentMesh.Vertices[currentFace.B];
        var vertexC = currentMesh.Vertices[currentFace.C];

        //very very well coded

        var pixelA = this.project(vertexA, transformMatrix);
        var pixelB = this.project(vertexB, transformMatrix);
        var pixelC = this.project(vertexC, transformMatrix);

        // compute normal vector
        var vector1 = new BABYLON.Vector3(
          vertexA.x - vertexB.x,
          vertexA.y - vertexB.y,
          vertexA.z - vertexB.z
        );
        var vector2 = new BABYLON.Vector3(
          vertexA.x - vertexC.x,
          vertexA.y - vertexC.y,
          vertexA.z - vertexC.z
        );

        var normalVector = new BABYLON.Vector3(
          vector1.x * vector2.y - vector1.y * vector2.x,
          vector1.y * vector2.z - vector1.z * vector2.y,
          vector1.z * vector2.x - vector1.x * vector2.z
        );

        // we use order x,z,y because of dot product changing order. Do you follow ?
        normalVector = this.project(
          normalVector,
          BABYLON.Matrix.RotationYawPitchRoll(
            currentMesh.Rotation.x,
            currentMesh.Rotation.z,
            currentMesh.Rotation.y
          )
        );

        var color =
          normalVector.x * SoftEngine.light.Direction.x +
          normalVector.y * SoftEngine.light.Direction.y +
          normalVector.z * SoftEngine.light.Direction.z;

        color =
          color /
          Math.sqrt(
            normalVector.x ** 2 + normalVector.y ** 2 + normalVector.z ** 2
          );

        color =
          color /
          Math.sqrt(
            SoftEngine.light.Direction.x ** 2 +
              SoftEngine.light.Direction.y ** 2 +
              SoftEngine.light.Direction.z ** 2
          );

        color = color / 2 + 1 / 2;
        // if (indexFaces == 0) {
        //   color3 = 1;
        // }
        // good :

        //color = indexFaces / currentMesh.Faces.length;

        this.drawTriangle(
          pixelA,
          pixelB,
          pixelC,
          new BABYLON.Color4(1, 1, 1, color)
        );
      }
    }
  }
}

var SoftEngine = {};
var canvas;
var cube;
var meshes = [];
var fpsArea;
var lastTime;

document.addEventListener("DOMContentLoaded", init, false);

function init() {
  fpsArea = document.getElementById("fps");
  lastTime = Date.now();

  canvas = document.getElementById("maincanvas"); //well coded
  canvas.width = window.innerWidth; //sympa la fonction
  canvas.height = window.innerHeight;
  console.info("Document loaded"); //well coded
  SoftEngine.camera = new Camera();
  SoftEngine.device = new Device(canvas);
  SoftEngine.light = new Light(-10, -10, 10);

  cube = new Mesh("Cube", 8, 12, [0, 0, 0], [0, 0, 0]);
  icosaedre = new Mesh("Ico", 12, 20, [0, 0, 0], [0, 0, 0]);

  //meshes.push(cube); //very welle codedde
  meshes.push(icosaedre);

  cube.Vertices[0] = new BABYLON.Vector3(-1, 1, 1);
  cube.Vertices[1] = new BABYLON.Vector3(1, 1, 1);
  cube.Vertices[2] = new BABYLON.Vector3(-1, -1, 1);
  cube.Vertices[3] = new BABYLON.Vector3(1, -1, 1);
  cube.Vertices[4] = new BABYLON.Vector3(-1, 1, -1);
  cube.Vertices[5] = new BABYLON.Vector3(1, 1, -1);
  cube.Vertices[6] = new BABYLON.Vector3(1, -1, -1);
  cube.Vertices[7] = new BABYLON.Vector3(-1, -1, -1);

  icosaedre.Vertices[0] = new BABYLON.Vector3(1, (1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[1] = new BABYLON.Vector3(-1, (1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[2] = new BABYLON.Vector3(1, -(1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[3] = new BABYLON.Vector3(-1, -(1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[4] = new BABYLON.Vector3((1 + Math.sqrt(5)) / 2, 0, 1);
  icosaedre.Vertices[5] = new BABYLON.Vector3((1 + Math.sqrt(5)) / 2, 0, -1);
  icosaedre.Vertices[6] = new BABYLON.Vector3(-(1 + Math.sqrt(5)) / 2, 0, 1);
  icosaedre.Vertices[7] = new BABYLON.Vector3(-(1 + Math.sqrt(5)) / 2, 0, -1);
  icosaedre.Vertices[8] = new BABYLON.Vector3(0, 1, (1 + Math.sqrt(5)) / 2);
  icosaedre.Vertices[9] = new BABYLON.Vector3(0, -1, (1 + Math.sqrt(5)) / 2);
  icosaedre.Vertices[10] = new BABYLON.Vector3(0, 1, -(1 + Math.sqrt(5)) / 2);
  icosaedre.Vertices[11] = new BABYLON.Vector3(0, -1, -(1 + Math.sqrt(5)) / 2);

  icosaedre.Faces[0] = { A: 1, B: 7, C: 6 }; // 1,7,6
  icosaedre.Faces[1] = { A: 0, B: 1, C: 8 }; // 0,1,8
  icosaedre.Faces[2] = { A: 0, B: 10, C: 1 }; // 0,10,1
  icosaedre.Faces[3] = { A: 1, B: 6, C: 8 }; // 1,6,8
  icosaedre.Faces[4] = { A: 1, B: 10, C: 7 }; // 1,10,7
  icosaedre.Faces[5] = { A: 4, B: 0, C: 8 }; // 4,0,8
  icosaedre.Faces[6] = { A: 0, B: 5, C: 10 }; // 0,5,10
  icosaedre.Faces[7] = { A: 0, B: 4, C: 5 }; // 0,4,5
  icosaedre.Faces[8] = { A: 4, B: 8, C: 9 }; // 4,8,9
  icosaedre.Faces[9] = { A: 6, B: 9, C: 8 }; // 6,9,8
  icosaedre.Faces[10] = { A: 3, B: 9, C: 6 }; // 3,9,6 - pas choquant
  icosaedre.Faces[11] = { A: 3, B: 6, C: 7 }; // 3,6,7
  icosaedre.Faces[12] = { A: 3, B: 7, C: 11 }; // 3,7,11
  icosaedre.Faces[13] = { A: 7, B: 10, C: 11 }; // 7,10,11
  icosaedre.Faces[14] = { A: 5, B: 11, C: 10 }; // 5,11,10 - les deux bizarres
  icosaedre.Faces[15] = { A: 3, B: 11, C: 2 }; // 3,11,2
  icosaedre.Faces[16] = { A: 5, B: 2, C: 11 }; // 5,2,11 - les deux bizarres
  icosaedre.Faces[17] = { A: 2, B: 9, C: 3 }; // 2,9,1
  icosaedre.Faces[18] = { A: 4, B: 2, C: 5 }; // 4,2,5
  icosaedre.Faces[19] = { A: 2, B: 4, C: 9 }; // 2,4,9

  cube.Faces[0] = { A: 0, B: 2, C: 1 };
  cube.Faces[1] = { A: 1, B: 2, C: 3 };
  cube.Faces[2] = { A: 1, B: 3, C: 6 };
  cube.Faces[3] = { A: 1, B: 6, C: 5 };
  cube.Faces[4] = { A: 0, B: 1, C: 4 };
  cube.Faces[5] = { A: 1, B: 5, C: 4 };

  cube.Faces[6] = { A: 2, B: 7, C: 3 };
  cube.Faces[7] = { A: 3, B: 7, C: 6 };
  cube.Faces[8] = { A: 0, B: 7, C: 2 };
  cube.Faces[9] = { A: 0, B: 4, C: 7 };
  cube.Faces[10] = { A: 4, B: 5, C: 6 };
  cube.Faces[11] = { A: 4, B: 6, C: 7 };

  SoftEngine.camera.Position = new BABYLON.Vector3(10, 10, 10);
  SoftEngine.camera.Target = new BABYLON.Vector3(0, 0, 0);
  let down = false;
  let [x, y, z] = [
    SoftEngine.camera.Position.x,
    SoftEngine.camera.Position.y,
    SoftEngine.camera.Position.z,
  ];
  var rho = Math.sqrt(x * x + y * y + z * z);
  var teta = Math.atan(z / y);
  var phi = Math.acos(y / rho);

  canvas.addEventListener("mousedown", () => (down = true));
  canvas.addEventListener("mouseup", () => (down = false));
  canvas.addEventListener("mousemove", function (event) {
    if (down && event.buttons == 1) {
      teta -= event.movementX / 200;
      phi -= event.movementY / 200;
      if (phi < 0) phi = 0.0001;
      if (phi > Math.PI) phi = Math.PI;
      SoftEngine.camera.Position.x =
        SoftEngine.camera.Target.x + rho * Math.sin(phi) * Math.cos(teta);
      SoftEngine.camera.Position.z =
        SoftEngine.camera.Target.z + rho * Math.sin(phi) * Math.sin(teta);
      SoftEngine.camera.Position.y =
        SoftEngine.camera.Target.y + rho * Math.cos(phi);
    } else if (down && event.buttons == 4) {
      SoftEngine.camera.Target.x -= (Math.cos(teta) * event.movementY) / 100;
      SoftEngine.camera.Target.z -= (Math.sin(teta) * event.movementY) / 100;
      SoftEngine.camera.Target.x += (Math.sin(teta) * event.movementX) / 100;
      SoftEngine.camera.Target.z -= (Math.cos(teta) * event.movementX) / 100;
    }
  });

  // pause movements with any key !
  document.addEventListener("keydown", () => (pause = !pause));

  canvas.onwheel = (event) => {
    event.preventDefault;
    rho += event.deltaY / 100;
    SoftEngine.camera.Position.x = rho * Math.sin(phi) * Math.cos(teta);
    SoftEngine.camera.Position.z = rho * Math.sin(phi) * Math.sin(teta);
    SoftEngine.camera.Position.y = rho * Math.cos(phi);
  };

  // Calling the HTML5 rendering loop
  requestAnimationFrame(drawingLoop);
}

// Rendering loop handler
function drawingLoop() {
  SoftEngine.device.clear();
  fpsArea.innerText = Math.round(1000 / (Date.now() - lastTime)) + " fps";
  lastTime = Date.now();

  if (!pause) icosaedre.Rotation.z = Math.cos(Date.now() / 2000) * Math.PI;
  if (!pause) icosaedre.Rotation.x = Math.cos(Date.now() / 5000) * Math.PI;

  // Doing the various matrix operations
  SoftEngine.device.render(SoftEngine.camera, meshes);
  // Flushing the back buffer into the front buffer
  SoftEngine.device.present();

  // Calling the HTML5 rendering loop recursively
  requestAnimationFrame(drawingLoop);
}

var pause = true;
