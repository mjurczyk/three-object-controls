import * as Three from 'three';

export const TransformControlsMode = {
  translate: 'translate',
  elevate: 'elevate',
  rotate: 'rotate',
};

export const TransformControlsSpace = {
  world: 'world',
  local: 'local',
};

export const TransformControlsArrowStyle = {
  caret: 'caret',
  arrow: 'arrow',
};

const DefaultOptions = {
  translateArrowColor: 0x000000,
  translateArrowStyle: TransformControlsArrowStyle.arrow,
  elevateArrowColor: 0x000000,
  rotateArrowColor: 0x000000,
  physicalGizmo: true
};

const ChangeEvent = { type: 'change' };
const MouseDownEvent = { type: 'mouseDown' };
const MouseUpEvent = { type: 'mouseUp' };
const ObjectChangeEvent = { type: 'objectChange' };

export class TransformControls extends Three.Object3D {
  isTransformControls = true;

  visible = false;
  domElement = null;

  ray = new Three.Raycaster();
  _tempVector = new Three.Vector3();
  _tempQuaterion = new Three.Quaternion();

  pointStart = new Three.Vector3();
	pointEnd = new Three.Vector3();
	offset = new Three.Vector3();
	rotationAxis = new Three.Vector3();
	rotationAngle = 0;

	cameraPosition = new Three.Vector3();
	cameraQuaternion = new Three.Quaternion();
	cameraScale = new Three.Vector3();

	parentPosition = new Three.Vector3();
	parentQuaternion = new Three.Quaternion();
	parentQuaternionInv = new Three.Quaternion();
	parentScale = new Three.Vector3();

	worldPositionStart = new Three.Vector3();
	worldQuaternionStart = new Three.Quaternion();
	worldScaleStart = new Three.Vector3();

	worldPosition = new Three.Vector3();
	worldQuaternion = new Three.Quaternion();
	worldQuaternionInv = new Three.Quaternion();
	worldScale = new Three.Vector3();

  eye = new Three.Vector3();
  controlPlane = new TransformControlsPlane();
  controlGizmo = new TransformControlsGizmo();

	positionStart = new Three.Vector3();
	quaternionStart = new Three.Quaternion();
	scaleStart = new Three.Vector3();

  constructor(camera, domElement = document, options = DefaultOptions) {
    super();

    this.domElement = domElement;
    this.camera = camera;
    this.options = DefaultOptions;

    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerHover = this.onPointerHover.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);

    this.init();
  }

  init() {
    this.add(this.controlPlane);
    this.add(this.controlGizmo);

    this.sharedProp('camera', this.camera);
    this.sharedProp('object', null);
    this.sharedProp('enabled', true);
    this.sharedProp('axis', null);
    this.sharedProp('mode', TransformControlsMode.rotate);
    this.sharedProp('translationSnap', null);
    this.sharedProp('rotationSnap', null);
    this.sharedProp('space', TransformControlsSpace.world);
    this.sharedProp('size', 1);
    this.sharedProp('dragging', false);

    this.sharedProp('worldPosition', this.worldPosition);
    this.sharedProp('worldPositionStart', this.worldPositionStart);
    this.sharedProp('worldQuaternion', this.worldQuaternion);
    this.sharedProp('worldQuaternionStart', this.worldQuaternionStart);
    this.sharedProp('cameraPosition', this.cameraPosition);
    this.sharedProp('cameraQuaternion', this.cameraQuaternion);
    this.sharedProp('pointStart', this.pointStart);
    this.sharedProp('pointEnd', this.pointEnd);
    this.sharedProp('rotationAxis', this.rotationAxis);
    this.sharedProp('rotationAngle', this.rotationAngle);
    this.sharedProp('eye', this.eye);

    this.domElement.addEventListener('mousedown', this.onPointerDown, false);
    this.domElement.addEventListener('touchstart', this.onPointerDown, false);
    this.domElement.addEventListener('mousemove', this.onPointerHover, false);
    this.domElement.addEventListener('touchmove', this.onPointerHover, false);
    this.domElement.addEventListener('touchmove', this.onPointerMove, false);
    this.domElement.addEventListener('touchend', this.onPointerUp, false);
    this.domElement.addEventListener('touchcancel', this.onPointerUp, false);
    this.domElement.addEventListener('touchleave', this.onPointerUp, false);

    document.addEventListener('mouseup', this.onPointerUp, false);
  }

  dispose() {
    this.domElement.removeEventListener('mousedown', this.onPointerDown);
    this.domElement.removeEventListener('touchstart', this.onPointerDown);
    this.domElement.removeEventListener('mousemove', this.onPointerHover);
    this.domElement.removeEventListener('touchmove', this.onPointerHover);
    this.domElement.removeEventListener('touchmove', this.onPointerMove);
    this.domElement.removeEventListener('touchend', this.onPointerUp);
    this.domElement.removeEventListener('touchcancel', this.onPointerUp);
    this.domElement.removeEventListener('touchleave', this.onPointerUp);

    document.removeEventListener('mouseup', this.onPointerUp);
    document.removeEventListener('mousemove', this.onPointerMove);

    this.traverse(child => {
      if (child.geometry) {
        child.geometry.dispose();
      }

      if (child.material) {
        child.material.dispose();
      }
    });
  }

  sharedProp(propName, defaultValue) {
    const context = this;
    let propValue = defaultValue;

    Object.defineProperty(context, propName, {
      get: () => typeof propValue !== 'undefined' ? propValue : defaultValue,
      set: value => {
        if (value !== propValue) {
          propValue = value;
          context.controlPlane[propName] = value;
          context.controlGizmo[propName] = value;

          context.dispatchEvent({ type: `${propName}-changed`, value });
          context.dispatchEvent(ChangeEvent);
        }
      }
    });

    context[propValue] = propValue;
    context.controlPlane[propName] = propValue;
    context.controlGizmo[propName] = propValue;
  }

  attach(object) {
    this.object = object;
    this.visible = true;

    return this;
  }

  detach() {
    this.object = null;
    this.visible = false;
    this.axis = null;

    return this;
  }

  updateMatrixWorld() {
    if (this.object && this.object.parent) {
      this.object.updateMatrixWorld();
      this.object.parent.matrixWorld.decompose(this.parentPosition, this.parentQuaternion, this.parentScale);
      this.object.matrixWorld.decompose(this.worldPosition, this.worldQuaternion, this.worldScale);

      this.parentQuaternionInv.copy(this.parentQuaternion).inverse();
      this.worldQuaternionInv.copy(this.worldQuaternionInv).inverse();
    }

    this.camera.updateMatrixWorld();
    this.camera.matrixWorld.decompose(this.cameraPosition, this.cameraQuaternion, this.cameraScale);

    this.eye.copy(this.cameraPosition).sub(this.worldPosition).normalize();

    Three.Object3D.prototype.updateMatrixWorld.call(this);
  }

  pointerHover(pointer) {
    if (!this.object || this.dragging || (typeof pointer.button !== 'undefined' && pointer.button !== 0)) {
      return;
    }

    this.ray.setFromCamera(pointer, this.camera);

    const intersect = this.ray.intersectObjects([ this.controlGizmo.picker ], true)[0] || false;

    if (intersect) {
      this.axis = true;
    } else {
      this.axis = null;
    }
  }

  pointerDown(pointer) {
    if (!this.object || this.dragging || (typeof pointer.button !== 'undefined' && pointer.button !== 0)) {
      return;
    }

    if ((pointer.button === 0 || typeof pointer.button === 'undefined') && this.axis !== null) {
      this.ray.setFromCamera(pointer, this.camera);

      const intersect = this.ray.intersectObjects([ this.controlPlane ], true)[0] || false;

      if (intersect) {
        this.object.updateMatrixWorld();

        if (this.object.parent) {
          this.object.parent.updateMatrixWorld();
        }

        this.positionStart.copy(this.object.position);
        this.quaternionStart.copy(this.object.quaternion);

        this.object.matrixWorld.decompose(this.worldPositionStart, this.worldQuaternionStart, this.worldScaleStart);

        this.pointStart.copy(intersect.point).sub(this.worldPositionStart);
      }

      this.dragging = true;
      this.dispatchEvent({
        ...MouseDownEvent,
        mode: this.mode
      });
    }
  }

  pointerMove(pointer) {
    if (!this.object || !this.axis || !this.dragging || (typeof pointer.button !== 'undefined' && pointer.button !== 0)) {
      return;
    }

    this.ray.setFromCamera(pointer, this.camera);

    const intersect = this.ray.intersectObjects([ this.controlPlane ], true)[0] || false;

    if (!intersect) {
      return;
    }

    this.pointEnd.copy(intersect.point).sub(this.worldPositionStart);

    if ([TransformControlsMode.translate, TransformControlsMode.elevate].includes(this.mode)) {
      this.offset.copy(this.pointEnd).sub(this.pointStart);

      if (this.space === TransformControlsSpace.local) {
        this.offset.applyQuaternion(this.worldQuaternionInv);
      }

      if (this.mode === TransformControlsMode.translate) {
        this.offset.y = 0;
      } else {
        this.offset.x = 0;
        this.offset.z = 0;
      }

      if (this.space === TransformControlsSpace.local) {
        this.offset.applyQuaternion(this.quaternionStart).divide(this.parentScale);
      }

      this.object.position.copy(this.offset).add(this.positionStart);

      if (this.translationSnap) {
        if (this.space === TransformControlsSpace.local) {
          this.object.position.applyQuaternion(this._tempQuaterion.copy(this.quaternionStart).inverse());
        } else if (this.space === TransformControlsSpace.world && this.object.parent) {
          this.object.position.add(this._tempVector.setFromMatrixPosition(this.object.parent.matrixWorld));
        }

        if (this.mode === TransformControlsMode.translate) {
          this.object.position.x = Math.round(this.object.position.x / this.translationSnap) * this.translationSnap;
          this.object.position.z = Math.round(this.object.position.z / this.translationSnap) * this.translationSnap;
        } else {
          this.object.position.y = Math.round(this.object.position.y / this.translationSnap) * this.translationSnap;
        }

        if (this.space === TransformControlsSpace.local) {
          this.object.position.applyQuaternion(this.quaternionStart);
        } else if (this.space === TransformControlsSpace.world && this.object.parent) {
          this.object.position.sub(this._tempVector.setFromMatrixPosition(this.object.parent.matrixWorld));
        }
      }
    } else if (this.mode === TransformControlsMode.rotate) {
      this.offset.copy(this.pointEnd).sub(this.pointStart);
      
      const rotationSpeed = 20.0 / this.worldPosition.distanceTo(this._tempVector.setFromMatrixPosition(this.camera.matrixWorld));

      this.rotationAxis.set(0, 1, 0);
      this._tempVector.copy(this.rotationAxis);

      if (this.space === TransformControlsSpace.local) {
        this._tempVector.applyQuaternion(this.worldQuaternion);
      }

      this.rotationAngle = this.offset.dot(this._tempVector.cross(this.eye).normalize()) * rotationSpeed;

      if (this.rotationSnap) {
        this.rotationAngle = Math.round(this.rotationAngle / this.rotationSnap) * this.rotationSnap;
      }

      if (this.space === TransformControlsSpace.local) {
        this.object.quaternion.copy(this.quaternionStart);
        this.object.quaternion.multiply(this._tempQuaterion.setFromAxisAngle(this.rotationAxis, this.rotationAngle)).normalize();
      } else {
        this.rotationAxis.applyQuaternion(this.parentQuaternionInv);
        this.object.quaternion.copy(this._tempQuaterion.setFromAxisAngle(this.rotationAxis, this.rotationAngle));
        this.object.quaternion.multiply(this.quaternionStart).normalize();
      }
    }

    this.dispatchEvent(ChangeEvent);
		this.dispatchEvent(ObjectChangeEvent);
  }

  pointerUp(pointer) {
    if (typeof pointer.button !== 'undefined' && pointer.button !== 0) {
      return;
    }

    if (this.dragging && this.axis !== null) {
      this.dispatchEvent({
        ...MouseUpEvent,
        mode: this.mode
      });
    }

    this.dragging = false;

    if (typeof pointer.button !== 'undefined') {
      this.axis = null;
    }
  }

  getPointer(event) {
    const pointer = event.changedTouches ? event.changedTouches[0] : event;
    const viewport = this.domElement.getBoundingClientRect();

    return {
      x: (pointer.clientX - viewport.left) / viewport.width * 2 - 1,
      y: -(pointer.clientY - viewport.top) / viewport.height * 2 + 1,
      button: event.button
    }
  }

  onPointerHover(event) {
    if (!this.enabled) {
      return;
    }

    this.pointerHover(this.getPointer(event));
  }

  onPointerDown(event) {
    if (!this.enabled) {
      return;
    }

    const pointer = this.getPointer(event);

    document.addEventListener('mousemove', this.onPointerMove, false);

    this.pointerHover(pointer);
    this.pointerDown(pointer)
  }

  onPointerMove(event) {
    if (!this.enabled) {
      return;
    }

    this.pointerMove(this.getPointer(event));
  }

  onPointerUp(event) {
    if (!this.enabled) {
      return;
    }

		document.removeEventListener('mousemove', this.onPointerMove);

    this.pointerUp(this.getPointer(event));
  }

  getMode() {
    return this.mode;
  }

  setMode(mode) {
    this.mode = mode;
  }

  setTranslationSnap(snap) {
    this.translationSnap = snap;
  }

  setRotationSnap(snap) {
    this.rotationSnap = snap;
  }

  setScaleSnap(snap) { /* legacy */ }

  setSize(size) {
    this.size = size;
  }

  setSpace(space) {
    this.space = space;
  }

  update() { /* legacy */ }
}

class TransformControlsPlane extends Three.Mesh {
  isTransformControlsPlane = true;
  type = 'TransformControlsPlane';

  unitX = new Three.Vector3( 1, 0, 0 );
	unitY = new Three.Vector3( 0, 1, 0 );
	unitZ = new Three.Vector3( 0, 0, 1 );

	tempVector = new Three.Vector3();
	dirVector = new Three.Vector3();
	alignVector = new Three.Vector3();
	tempMatrix = new Three.Matrix4();
	identityQuaternion = new Three.Quaternion();

  constructor() {
    super(
      new Three.PlaneBufferGeometry(100000, 100000, 2, 2),
      new Three.MeshBasicMaterial({ visible: false, side: Three.DoubleSide, transparent: true, opacity: 0 }),
    );
  }

  updateMatrixWorld() {
    this.position.copy(this.worldPosition);

    this.unitX.set(1, 0, 0).applyQuaternion(this.space === TransformControlsSpace.local ? this.worldQuaternion : this.identityQuaternion);
    this.unitY.set(0, 1, 0).applyQuaternion(this.space === TransformControlsSpace.local ? this.worldQuaternion : this.identityQuaternion);
    this.unitZ.set(0, 0, 1).applyQuaternion(this.space === TransformControlsSpace.local ? this.worldQuaternion : this.identityQuaternion);

    if (this.mode === TransformControlsMode.translate) {
      this.alignVector.copy(this.unitZ);
      this.dirVector.copy(this.unitY);
    } else if (this.mode === TransformControlsMode.elevate) {
      this.alignVector.copy(this.eye).cross(this.unitY);
      this.dirVector.copy(this.unitY).cross(this.alignVector);
    } else if (this.mode === TransformControlsMode.rotate) {
      this.alignVector.copy(this.unitY);
      this.dirVector.set(0, 0, 0);
    }
    
    if (!this.dirVector.length()) {
      this.quaternion.copy(this.cameraQuaternion);
    } else {
      this.tempMatrix.lookAt(this.tempVector.setScalar(0), this.dirVector, this.alignVector);
      this.quaternion.setFromRotationMatrix(this.tempMatrix);
    }

    Three.Object3D.prototype.updateMatrixWorld.call(this);
  }
}

class TransformControlsGizmo extends Three.Object3D {
  isTransformControlsGizmo = true;
  type = 'TransformControlsGizmo';

  picker = null;
  gizmo = new Three.Object3D();
  gizmoTranslate = null;
  gizmoElevate = null;
  gizmoRotate = null;
  identityQuaternion = new Three.Quaternion();
  objectBoundingBox = new Three.Box3();

  baseMaterialConfig = {
    color: 0x000000,
    depthTest: false,
    roughness: .75,
    metalness: .98,
    transparent: false,
  };

  constructor(options = DefaultOptions) {
    super();

    this.options = options;

    this.init();
  }

  init() {
    this.picker = new Three.Mesh(
      new Three.SphereBufferGeometry(1, 8, 8),
      new Three.MeshBasicMaterial({ visible: false, side: Three.DoubleSide, transparent: true, opacity: 0 }),
    );
    this.gizmo.add(this.getTranslateGizmoMesh());
    this.gizmo.add(this.getElevateGizmoMesh());
    this.gizmo.add(this.getRotateGizmoMesh());

    this.add(this.picker);
    this.add(this.gizmo);
  }

  getObjectSize() {
    if (!this.object) {
      return new Three.Vector3(1, 1, 1);
    }

    this.objectBoundingBox.setFromObject(this.object);
  }

  getTranslateGizmoMesh() {
    const { translateArrowStyle, translateArrowColor, physicalGizmo } = this.options;

    const gizmo = new Three.Object3D();

    const material = new Three.MeshStandardMaterial({
      ...this.baseMaterialConfig,
      color: translateArrowColor,
      depthTest: !!physicalGizmo,
    });

    const mesh = new Three.Mesh(
      this.getArrowGeometry(2, translateArrowStyle === TransformControlsArrowStyle.caret),
      material
    );
    mesh.rotateX(-Math.PI / 2);
    mesh.scale.setScalar(4);

    [
      mesh.clone(),
      mesh.clone().rotateZ(Math.PI / 2),
      mesh.clone().rotateZ(Math.PI),
      mesh.clone().rotateZ(-Math.PI / 2),
    ].forEach(directionArrow => gizmo.add(directionArrow));

    this.gizmoTranslate = gizmo;

    return gizmo;
  }

  getElevateGizmoMesh() {
    const { elevateArrowColor, physicalGizmo } = this.options;

    const gizmo = new Three.Object3D();

    const material = new Three.MeshStandardMaterial({
      ...this.baseMaterialConfig,
      color: elevateArrowColor,
      depthTest: !!physicalGizmo,
    });

    const mesh = new Three.Mesh(
      this.getArrowGeometry(2, false),
      material
    );
    mesh.scale.setScalar(4);

    [
      mesh.clone().rotateZ(Math.PI),
      mesh.clone(),
    ].forEach(directionArrow => gizmo.add(directionArrow));

    this.gizmoElevate = gizmo;

    return gizmo;
  }

  getRotateGizmoMesh() {
    const { rotateArrowColor } = this.options;

    const gizmo = new Three.Object3D();

    const material = new Three.MeshStandardMaterial({
      ...this.baseMaterialConfig,
      color: rotateArrowColor,
    });

    const curveThickness = .25;
    const curveAngleOffset = Three.MathUtils.degToRad(70);

    const curveShape = new Three.Shape();
    curveShape.moveTo(-.5, 0);
    curveShape.absarc(0, 0, 1, Math.PI + curveAngleOffset, Math.PI * 2, true);
    curveShape.absarc(0, 0, 1 - curveThickness, Math.PI * 2, Math.PI + curveAngleOffset);

    const curveMesh = new Three.Mesh(new Three.ExtrudeBufferGeometry(curveShape, {
        bevelEnabled: false,
        steps: 1,
        curveSegments: 24,
        depth: .25
      }),
      material
    );
    curveMesh.rotateX(-Math.PI / 2);
    curveMesh.scale.setScalar(4);

    const arrowMesh = new Three.Mesh(this.getArrowGeometry(2, true), material);
    arrowMesh.translateX((1.5 - curveThickness) * 2 + 1);
    arrowMesh.translateY(1);
    arrowMesh.rotateX(-Math.PI / 2);
    arrowMesh.rotateX(Math.PI);
    arrowMesh.scale.setScalar(4);

    gizmo.add(arrowMesh);
    gizmo.add(curveMesh);

    this.gizmoRotate = gizmo;

    return gizmo;
  }

  getArrowGeometry(arrowLength = 1, hollow = false) {
    const arrowTipOffsetX = .25;
    const arrowTipOffsetY = .7;
    const arrowDepth = .25;

    const shape = new Three.Shape();

    if (hollow) {
      shape.moveTo(-.5, 0);
      shape.lineTo(0, arrowTipOffsetY);
      shape.lineTo(.5, 0);
      shape.lineTo(-.5, 0);
    } else {
      shape.moveTo(-arrowTipOffsetX, 0);
      shape.lineTo(arrowTipOffsetX, 0);
      shape.lineTo(arrowTipOffsetX, arrowLength - arrowTipOffsetY);
      shape.lineTo(.5, arrowLength - arrowTipOffsetY);
      shape.lineTo(0, arrowLength);
      shape.lineTo(-.5, arrowLength - arrowTipOffsetY);
      shape.lineTo(-arrowTipOffsetX, arrowLength - arrowTipOffsetY);
      shape.lineTo(-arrowTipOffsetX, 0);
    }

    return new Three.ExtrudeBufferGeometry(shape, {
      bevelEnabled: false,
      steps: 1,
      depth: arrowDepth
    });
  }

  updateMatrixWorld() {
    const quaternion = this.space === TransformControlsSpace.local ? this.worldQuaternion : this.identityQuaternion;

    this.picker.rotation.set(0, 0, 0);

    this.gizmoTranslate.visible = this.mode === TransformControlsMode.translate;
    this.gizmoElevate.visible = this.mode === TransformControlsMode.elevate;
    this.gizmoRotate.visible = this.mode === TransformControlsMode.rotate;

    if (this.object) {
      this.getObjectSize();

      const objectPosition = this.objectBoundingBox.getCenter();
      const objectSize = this.objectBoundingBox.getSize();
      const objectMaxOffsetXZ = Math.max(objectSize.x, objectSize.z);
      const objectMaxOffsetXYZ = Math.max(objectSize.x, objectSize.y, objectSize.z);

      this.picker.scale.setScalar(objectMaxOffsetXYZ + 1);
      this.picker.position.copy(objectPosition);

      this.gizmo.position.set(objectPosition.x, objectPosition.y - (objectSize.y / 2) + .5, objectPosition.z);

      if (this.translateArrowStyle === TransformControlsArrowStyle.caret) {
        this.gizmoTranslate.children.forEach(directionArrow => {
          const directionVector = new Three.Vector3();
          directionArrow.getWorldDirection(directionVector);

          directionArrow.position.setScalar(0);
          directionArrow.translateOnAxis(directionVector, objectMaxOffsetXZ / 2 + 1);
        });
      }
    } else {
      this.picker.position.copy(this.worldPosition);
      this.gizmo.position.copy(this.worldPosition);
      this.picker.scale.set(2, 2, 2);
    }

    this.picker.scale.max(new Three.Vector3().setScalar(10));
    this.picker.quaternion.copy(quaternion);

    Three.Object3D.prototype.updateMatrixWorld.call(this);
  }
}
