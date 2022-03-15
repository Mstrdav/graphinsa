/**
 * A class representing a camera.
 * @constructor
 * @param [position=Vector3.Zero()] - the position of the camera
 * @param [target=Vector3.Zero()] - the target of the camera
 */
class Camera {
  constructor() {
    this.Position = Vector3.Zero();
    this.Target = Vector3.Zero();
  }
}

/* A light is a point in space that radiates light */
class Light {
  constructor(x, y, z) {
    this.Direction = new Vector3(x, y, z);
  }
}

/* A Mesh is a collection of vertices and faces */
class Mesh {
  //well coded
  constructor(name, verticesCount, facesCount, position, rotation) {
    this.name = name;
    this.Vertices = new Array(verticesCount);
    this.Faces = new Array(facesCount);
    this.Rotation = new Vector3(rotation[0], rotation[1], rotation[2]);
    this.Position = new Vector3(position[0], position[1], position[2]);
  }
}

/* The engine is a class that
takes a canvas and a list of meshes and then draws them on the canvas */
class Device {
  constructor(canvas) {
    this.workingCanvas = canvas;
    this.workingWidth = canvas.width;
    this.workingHeight = canvas.height;
    this.workingContext = this.workingCanvas.getContext("2d");
    this.depthbuffer = new Array(this.workingWidth * this.workingHeight);
  }

  /**
   * Clears the canvas with black pixels
   */
  clear() {
    /* It clears the working canvas. */
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
      this.depthbuffer[i] = 10000000; //well codedd
    }
  }

  /**
   * It draws a pixel on the screen.
   * @param x - The x coordinate of the pixel to draw.
   * @param y - The y coordinate of the pixel to draw.
   * @param z - The Z-value of the pixel.
   * @param color - The color to draw.
   * @returns Nothing
   */
  putPixel(x, y, z, color) {
    this.backbufferdata = this.backbuffer.data;

    /* The following code is calculating the index of the pixel in the image data array. */
    var index = (x >> 0) + (y >> 0) * this.workingWidth;
    var index4 = index * 4;

    /* Checking if the depth buffer value at the current pixel is less than the current z value. If it
    is, then it is discarding the pixel. */
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

  /**
   * It takes a coordinate and a transformation matrix and transforms the coordinate using the
   * transformation matrix
   * @param coord - The coordinates of the point to be transformed.
   * @param transMat - The transformation matrix.
   * @returns The transformed coordinates.
   */
  project(coord, transMat) {
    // transforming the coordinates
    var point = Vector3.TransformCoordinates(coord, transMat);

    // The transformed coordinates will be based on coordinate system
    // starting on the center of the screen. But drawing on screen normally starts
    // from top left. We then need to transform them again to have x:0, y:0 on top left.
    var x = point.x * this.workingWidth + this.workingWidth / 2.0;
    var y = -point.y * this.workingHeight + this.workingHeight / 2.0;
    return new Vector3(x, y, point.z);
  }

  /**
   * Draw a point on the screen
   * @param point - The point to draw.
   * @param color - The color of the point to be drawn.
   */
  drawPoint(point, color) {
    // Clipping/cropping what's visible on screen
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

  /**
   * Given a line, draw it
   * @param y - the current scanline Y
   * @param pa - the first point of the first line to draw
   * @param pb - the point before the current point
   * @param pc - the point on the left
   * @param pd - the point at the bottom right of the triangle
   * @param color - the color to draw the point
   */
  processScanLine(y, pa, pb, pc, pd, color) {
    // Thanks to current Y, we can compute the gradient to compute others values like
    // the starting X (sx) and ending X (ex) to draw between
    // if pa.Y == pb.Y or pc.Y == pd.Y, gradient is forced to 1

    /* The following code is calculating the gradient of the line between two points. */
    var gradient1 = pa.y != pb.y ? (y - pa.y) / (pb.y - pa.y) : 1;
    var gradient2 = pc.y != pd.y ? (y - pc.y) / (pd.y - pc.y) : 1;

    /* Interpolating between the x values of pa and pb. */
    var sx = this.interpolate(pa.x, pb.x, gradient1) >> 0;

    // same for pc and pd
    var ex = this.interpolate(pc.x, pd.x, gradient2) >> 0;

    // starting Z & ending Z
    var z1 = this.interpolate(pa.z, pb.z, gradient1);
    var z2 = this.interpolate(pc.z, pd.z, gradient2);

    /* Drawing a line between two points. */
    for (var x = sx; x < ex; x++) {
      var gradient = (x - sx) / (ex - sx);
      var z = this.interpolate(z1, z2, gradient);
      this.drawPoint(new Vector3(x, y, z), color);
    }
  }

  /**
   * It presents the backbuffer to the screen.
   */
  present() {
    this.workingContext.putImageData(this.backbuffer, 0, 0);
  }

  /**
   * Clamp a value between a minimum and maximum value
   * @param value - The value to clamp.
   * @param min - The minimum value to clamp to.
   * @param max - The maximum value to clamp to.
   * @returns The clamped value.
   */
  clamp(value, min, max) {
    if (typeof min === "undefined") {
      min = 0;
    }
    if (typeof max === "undefined") {
      max = 1;
    }
    return Math.max(min, Math.min(value, max));
  }

  /**
   * It takes three numbers, min, max, and gradient, and returns the result of interpolating between
   * min and max using the gradient
   * @param min - The minimum value of the gradient.
   * @param max - The maximum value of the gradient.
   * @param gradient - The gradient between the two values. 0 is equal to the min value, 0.5 is
   * halfway in between, etc.
   * @returns The interpolated value.
   */
  interpolate(min, max, gradient) {
    return min + (max - min) * this.clamp(gradient);
  }

  /**
   * Draw a triangle by drawing it line by line
   * @param p1 - The first point of the triangle
   * @param p2 - the second vertex of the triangle
   * @param p3 - the point of the triangle that is the bottom left point
   * @param color - the color to draw the triangle in
   */
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

  /**
   * We project the vertices of the mesh onto the screen, and then we draw the triangles
   * @param camera - the camera to use to render the scene.
   * @param meshes - The list of meshes to render.
   */
  render(camera, meshes) {
    /* The following code is creating a view matrix. */
    var viewMatrix = Matrix.LookAtLH(
      camera.Position,
      camera.Target,
      Vector3.Up()
    );

    /* Creating a projection matrix. */
    var projectionMatrix = Matrix.PerspectiveFovLH(
      0.78,
      this.workingWidth / this.workingHeight,
      0.01,
      1.0
    );

    for (var index = 0; index < meshes.length; index++) {
      /* Creating a variable called currentMesh and setting it equal to the meshes array at the index of the
      current index. */
      var currentMesh = meshes[index];

      /* The following code is creating a world matrix for the current mesh. */
      // note : we apply rotation before translation (otherwise it would go crazy)
      var worldMatrix = Matrix.RotationYawPitchRoll(
        currentMesh.Rotation.y,
        currentMesh.Rotation.x,
        currentMesh.Rotation.z
      ).multiply(
        Matrix.Translation(
          currentMesh.Position.x,
          currentMesh.Position.y,
          currentMesh.Position.z
        )
      );

      /* Multiplying the world matrix by the view matrix and then multiplying the result by the
      projection matrix. */
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

        var pixelA = this.project(vertexA, transformMatrix);
        var pixelB = this.project(vertexB, transformMatrix);
        var pixelC = this.project(vertexC, transformMatrix);

        /* Creating a vector from vertexA to vertexB. */
        var vector1 = new Vector3(
          vertexA.x - vertexB.x,
          vertexA.y - vertexB.y,
          vertexA.z - vertexB.z
        );
        var vector2 = new Vector3(
          vertexA.x - vertexC.x,
          vertexA.y - vertexC.y,
          vertexA.z - vertexC.z
        );

        /* Creating a new vector that is perpendicular to the two vectors. */
        var normalVector = Vector3.Cross(vector1, vector2);

        /* The above code is projecting the normal vector of the current face to the camera's
        coordinate system. */
        normalVector = this.project(
          normalVector,
          Matrix.RotationYawPitchRoll(
            currentMesh.Rotation.y,
            currentMesh.Rotation.x,
            currentMesh.Rotation.z
          )
        );

        /* The above code is calculating the dot product between the normal vector and the light
        direction vector, using it to color light or darker. */
        var color = Vector3.Dot(normalVector, Engine.light.Direction);

        /* Dividing the color by the length of the normal vector and the length of the light direction. */
        color = color / normalVector.length() / Engine.light.Direction.length();

        // we are bringing color from range [-1,1] to [0, 1]
        color = (color + 1) / 2;

        /* Drawing a triangle with the given points and color. */
        this.drawTriangle(pixelA, pixelB, pixelC, new Color4(1, 1, 1, color));
      }
    }
  }
}

var Engine = {};
var canvas;
var cube;
var meshes = [];
var fpsArea;
var lastTime;
var pause = false;

// when content is loaded, we start
document.addEventListener("DOMContentLoaded", init, false);

/**
 * It initializes the engine and starts the rendering loop.
 */
function init() {
  fpsArea = document.getElementById("fps");
  lastTime = Date.now();

  canvas = document.getElementById("maincanvas"); //well coded
  canvas.width = window.innerWidth; //sympa la fonction
  canvas.height = window.innerHeight;
  console.info("Document loaded"); //well coded
  Engine.camera = new Camera();
  Engine.device = new Device(canvas);
  Engine.light = new Light(10, 10, 10);

  cube = new Mesh("Cube", 8, 12, [1, -1, 1], [0, 0, 0]);
  icosaedre = new Mesh("Ico", 12, 20, [-1, 1, -1], [0, 0, 0]);

  meshes.push(cube); //very welle codedde
  meshes.push(icosaedre);

  cube.Vertices[0] = new Vector3(-1, 1, 1);
  cube.Vertices[1] = new Vector3(1, 1, 1);
  cube.Vertices[2] = new Vector3(-1, -1, 1);
  cube.Vertices[3] = new Vector3(1, -1, 1);
  cube.Vertices[4] = new Vector3(-1, 1, -1);
  cube.Vertices[5] = new Vector3(1, 1, -1);
  cube.Vertices[6] = new Vector3(1, -1, -1);
  cube.Vertices[7] = new Vector3(-1, -1, -1);

  icosaedre.Vertices[0] = new Vector3(1, (1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[1] = new Vector3(-1, (1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[2] = new Vector3(1, -(1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[3] = new Vector3(-1, -(1 + Math.sqrt(5)) / 2, 0);
  icosaedre.Vertices[4] = new Vector3((1 + Math.sqrt(5)) / 2, 0, 1);
  icosaedre.Vertices[5] = new Vector3((1 + Math.sqrt(5)) / 2, 0, -1);
  icosaedre.Vertices[6] = new Vector3(-(1 + Math.sqrt(5)) / 2, 0, 1);
  icosaedre.Vertices[7] = new Vector3(-(1 + Math.sqrt(5)) / 2, 0, -1);
  icosaedre.Vertices[8] = new Vector3(0, 1, (1 + Math.sqrt(5)) / 2);
  icosaedre.Vertices[9] = new Vector3(0, -1, (1 + Math.sqrt(5)) / 2);
  icosaedre.Vertices[10] = new Vector3(0, 1, -(1 + Math.sqrt(5)) / 2);
  icosaedre.Vertices[11] = new Vector3(0, -1, -(1 + Math.sqrt(5)) / 2);

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

  Engine.camera.Position = new Vector3(10, 10, 10);
  Engine.camera.Target = new Vector3(0, 0, 0);
  let down = false;
  let [x, y, z] = [
    Engine.camera.Position.x,
    Engine.camera.Position.y,
    Engine.camera.Position.z,
  ];
  var rho = Math.sqrt(x * x + y * y + z * z);
  var teta = Math.atan(z / y);
  var phi = Math.acos(y / rho);

  canvas.addEventListener("mousedown", () => (down = true));
  canvas.addEventListener("mouseup", () => (down = false));
  canvas.addEventListener("mousemove", function (event) {
    if (down && event.buttons == 1) {
      /* Moving the camera around the target. */
      teta -= event.movementX / 200;
      phi -= event.movementY / 200;
      if (phi < 0) phi = 0.0001;
      if (phi > Math.PI) phi = Math.PI;
      Engine.camera.Position.x =
        Engine.camera.Target.x + rho * Math.sin(phi) * Math.cos(teta);
      Engine.camera.Position.z =
        Engine.camera.Target.z + rho * Math.sin(phi) * Math.sin(teta);
      Engine.camera.Position.y = Engine.camera.Target.y + rho * Math.cos(phi);
    } else if (down && event.buttons == 4) {
      /* Moving the target of the camera. */
      Engine.camera.Target.x -= (Math.cos(teta) * event.movementY) / 100;
      Engine.camera.Target.z -= (Math.sin(teta) * event.movementY) / 100;
      Engine.camera.Target.x += (Math.sin(teta) * event.movementX) / 100;
      Engine.camera.Target.z -= (Math.cos(teta) * event.movementX) / 100;
    }
  });

  // start/pause movements with any key !
  document.addEventListener("keydown", () => (pause = !pause));

  /* Making the camera more or less distant. */
  canvas.onwheel = (event) => {
    event.preventDefault;
    rho += event.deltaY / 100;
    Engine.camera.Position.x = rho * Math.sin(phi) * Math.cos(teta);
    Engine.camera.Position.z = rho * Math.sin(phi) * Math.sin(teta);
    Engine.camera.Position.y = rho * Math.cos(phi);
  };

  /* Requesting that the browser call the function drawingLoop() every time the browser has an
  opportunity to draw a new frame of the animation. */
  requestAnimationFrame(drawingLoop);
}

/**
 * Render the scene, then present it on the screen.
 */
function drawingLoop() {
  // clear canvas
  Engine.device.clear();

  // compute fps
  fpsArea.innerText = Math.round(1000 / (Date.now() - lastTime)) + " fps";
  lastTime = Date.now();

  /* Rotating the icosahedron around the z axis and the x axis. */
  if (!pause) icosaedre.Rotation.z = Math.cos(Date.now() / 2000) * Math.PI;
  if (!pause) icosaedre.Rotation.x = Math.cos(Date.now() / 5000) * Math.PI;

  if (!pause) cube.Rotation.x = Math.cos(Date.now() / 4000) * Math.PI;
  if (!pause) cube.Rotation.y = Math.cos(Date.now() / 3000) * Math.PI;

  // Doing the various matrix operations
  Engine.device.render(Engine.camera, meshes);
  Engine.device.present();

  /* Calling the function drawingLoop() every 16.7 milliseconds. */
  requestAnimationFrame(drawingLoop);
}
