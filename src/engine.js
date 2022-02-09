class Camera {
  constructor() {
    this.Position = BABYLON.Vector3.Zero();
    this.Target = BABYLON.Vector3.Zero();
  }
}

// un mesh, c'est un ensemble de points et de faces (des triangles)
// en gros c'est un modèle, un objet
class Mesh {
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
  constructor(canvas) {
    this.workingCanvas = canvas;
    this.workingWidth = canvas.width;
    this.workingHeight = canvas.height;
    this.workingContext = this.workingCanvas.getContext("2d");
    this.depthbuffer = new Array(this.workingWidth * this.workingHeight);
  }
  // This function is called to clear the back buffer with a specific color
  clear() {
    // Clearing with black color by default
    this.workingContext.clearRect(0, 0, this.workingWidth, this.workingHeight);
    // once cleared with black pixels, we're getting back the associated image data to
    // clear out back buffer
    this.backbuffer = this.workingContext.getImageData(
      0,
      0,
      this.workingWidth,
      this.workingHeight
    );

    // Clearing depth buffer
    for (var i = 0; i < this.depthbuffer.length; i++) {
      // Max possible value
      this.depthbuffer[i] = 10000000;
    }
  }
  // Called to put a pixel on screen at a specific X,Y coordinates
  putPixel(x, y, z, color) {
    this.backbufferdata = this.backbuffer.data;
    // As we have a 1-D Array for our back buffer
    // we need to know the equivalent cell index in 1-D based
    // on the 2D coordinates of the screen
    var index = (x >> 0) + (y >> 0) * this.workingWidth;
    var index4 = index * 4;

    if (this.depthbuffer[index] < z) {
      return; // Discard
    }

    this.depthbuffer[index] = z;

    // RGBA color space is used by the HTML5 canvas
    this.backbufferdata[index4] = color.r * 255;
    this.backbufferdata[index4 + 1] = color.g * 255;
    this.backbufferdata[index4 + 2] = color.b * 255;
    this.backbufferdata[index4 + 3] = color.a * 255;
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
    this.workingContext.putImageData(this.backbuffer, 0, 0);
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
    // -   - P2
    // -  -
    // - -
    // -
    // P3
    if (dP1P2 > dP1P3) {
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
    // P2 -   -
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
      var cMesh = meshes[index];
      // Beware to apply rotation before translation
      var worldMatrix = BABYLON.Matrix.RotationYawPitchRoll(
        cMesh.Rotation.y,
        cMesh.Rotation.x,
        cMesh.Rotation.z
      ).multiply(
        BABYLON.Matrix.Translation(
          cMesh.Position.x,
          cMesh.Position.y,
          cMesh.Position.z
        )
      );

      var transformMatrix = worldMatrix
        .multiply(viewMatrix)
        .multiply(projectionMatrix);

      for (var indexFaces = 0; indexFaces < cMesh.Faces.length; indexFaces++) {
        var currentFace = cMesh.Faces[indexFaces];
        var vertexA = cMesh.Vertices[currentFace.A];
        var vertexB = cMesh.Vertices[currentFace.B];
        var vertexC = cMesh.Vertices[currentFace.C];

        var pixelA = this.project(vertexA, transformMatrix);
        var pixelB = this.project(vertexB, transformMatrix);
        var pixelC = this.project(vertexC, transformMatrix);

        var color =
          0.25 +
          ((indexFaces % cMesh.Faces.length) / cMesh.Faces.length) * 0.75;
        this.drawTriangle(
          pixelA,
          pixelB,
          pixelC,
          new BABYLON.Color4(color, color, color, 1)
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

  canvas = document.getElementById("maincanvas");
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  console.info("Document loaded");
  SoftEngine.camera = new Camera();
  SoftEngine.device = new Device(canvas);

  cube = new Mesh("Cube", 8, 12, [2, 0, 0], [0, 0, 0]);

  meshes.push(cube);

  cube.Vertices[0] = new BABYLON.Vector3(-1, 1, 1);
  cube.Vertices[1] = new BABYLON.Vector3(1, 1, 1);
  cube.Vertices[2] = new BABYLON.Vector3(-1, -1, 1);
  cube.Vertices[3] = new BABYLON.Vector3(1, -1, 1);
  cube.Vertices[4] = new BABYLON.Vector3(-1, 1, -1);
  cube.Vertices[5] = new BABYLON.Vector3(1, 1, -1);
  cube.Vertices[6] = new BABYLON.Vector3(1, -1, -1);
  cube.Vertices[7] = new BABYLON.Vector3(-1, -1, -1);

  cube.Faces[0] = { A: 0, B: 1, C: 2 };
  cube.Faces[1] = { A: 1, B: 2, C: 3 };
  cube.Faces[2] = { A: 1, B: 3, C: 6 };
  cube.Faces[3] = { A: 1, B: 5, C: 6 };
  cube.Faces[4] = { A: 0, B: 1, C: 4 };
  cube.Faces[5] = { A: 1, B: 4, C: 5 };

  cube.Faces[6] = { A: 2, B: 3, C: 7 };
  cube.Faces[7] = { A: 3, B: 6, C: 7 };
  cube.Faces[8] = { A: 0, B: 2, C: 7 };
  cube.Faces[9] = { A: 0, B: 4, C: 7 };
  cube.Faces[10] = { A: 4, B: 5, C: 6 };
  cube.Faces[11] = { A: 4, B: 6, C: 7 };

  cube2 = new Mesh("Cube2", 8, 12, [-2, 0, -5], [0, 0, 0]);
  cube2.Faces = cube.Faces;
  cube2.Vertices = cube.Vertices;

  meshes.push(cube2);

  //cube.Position = new BABYLON.Vector(0, 0, 0);

  SoftEngine.camera.Position = new BABYLON.Vector3(0, 0, 10);
  SoftEngine.camera.Target = new BABYLON.Vector3(0, 0, 0);

  // Calling the HTML5 rendering loop
  requestAnimationFrame(drawingLoop);
}

// Rendering loop handler
function drawingLoop() {
  SoftEngine.device.clear();
  fpsArea.innerText = Math.round(1000 / (Date.now() - lastTime)) + " fps";
  lastTime = Date.now();

  // rotating slightly the cube during each frame rendered
  cube.Rotation.x += 0.01;
  cube.Rotation.y += 0.01;

  cube2.Rotation.x -= 0.01;
  cube2.Rotation.y -= 0.01;

  SoftEngine.camera.Position.x += 0.05;
  SoftEngine.camera.Position.y += 0.05;

  // Doing the various matrix operations
  SoftEngine.device.render(SoftEngine.camera, meshes);
  // Flushing the back buffer into the front buffer
  SoftEngine.device.present();

  // Calling the HTML5 rendering loop recursively
  requestAnimationFrame(drawingLoop);
}
