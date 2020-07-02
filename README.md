![Work in progress](https://www.animatedimages.org/data/media/1664/animated-work-in-progress-image-0020.gif)

# ObjectControls

ObjectControls is a variation of the original TransformControls from three.js. Heavily opinionated, simplified, focusing on readability and looking nice in more casual apps.

## Key Differences

* TransformControls
  * Plenty of features
  * Plenty of complexity (+ legacy code)
  * Meant for: 3D tech demos

* ObjectControls
  * Simplified code, fewer features and complexity
  * Meant for: games, non-tech apps
  * Easy to customise

## Features

* Translation controls: moving the object on the horizontal plane (XZ)
* Elevation controls: moving the object on the vertical axis (Y)
* Rotation controls: rotating the object along UP-axis.

Removed features:
* Scaling
* Horizontal rotation (both X and Z)

## API

99% same as the [TransformControls](https://threejs.org/docs/#examples/en/controls/TransformControls), excluding the removed features.

Added third `options` argument in the constructor to allow customization, options

#### translateArrowColor (Three.Color | string | number)

Color of the translation arrows. Default black.

#### elevateArrowColor (Three.Color | string | number)

Color of the elevation arrows. Default black.

#### rotateArrowColor (Three.Color | string | number)

Color of the rotation arrow. Default black.

#### translateArrowStyle ('arrow' | 'caret')

Style of the translation arrow. Default `TransformControlsArrowStyle.arrow`.

(Can be set using exported interface `TransformControlsArrowStyle`)

#### physicalGizmo (boolean)

Enable depth testing of the gizmos. Default `false`.

