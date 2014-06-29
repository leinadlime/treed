
var DungeonsAndDragons = require('../../lib/dnd.js')
var Block = require('./block')

module.exports = View

function View(bindActions, model, ctrl, options) {
  this.mode = 'normal'
  this.active = null
  this.ids = {}

  this.bindActions = bindActions
  this.model = model
  this.ctrl = ctrl

  this._boundMove = this._onMouseMove.bind(this)
  this._boundUp = this._onMouseUp.bind(this)
  document.addEventListener('keyup', this._onKeyUp.bind(this))
}

View.prototype = {
  initialize: function (root) {
    var node = this.model.ids[root]
    this.setupRoot()
    this.root = root
    this.makeBlocks(root)
    return this.rootNode
  },

  setupRoot: function () {
    var rootNode = document.createElement('div')
    rootNode.className='whiteboard'
    rootNode.addEventListener('dblclick', this._onDoubleClick.bind(this))
    rootNode.addEventListener('click', this._onClick.bind(this))
    rootNode.addEventListener('mousedown', this._onMouseDown.bind(this))
    rootNode.addEventListener('wheel', this._onWheel.bind(this))
    this.container = document.createElement('div')
    this.container.className = 'whiteboard-container'

    this.controls = document.createElement('div')
    this.controls.className = 'whiteboard-controls'
    var b1 = document.createElement('button')
    b1.innerHTML = '1:1'
    b1.addEventListener('click', this.resetContainer.bind(this))
    var b2 = document.createElement('button')
    b2.innerHTML = '<i class="fa fa-th-large"/>'
    b2.addEventListener('click', this.resetPositions.bind(this))
    this.controls.appendChild(b1)
    this.controls.appendChild(b2)

    this.dropShadow = document.createElement('div')
    this.dropShadow.className = 'whiteboard-dropshadow'

    rootNode.appendChild(this.container)
    rootNode.appendChild(this.controls)
    rootNode.appendChild(this.dropShadow)
    this.rootNode = rootNode
    this.setContainerZoom(1)
    this.setContainerPos(0, 0)
  },

  // Controller / Commands API stuff

  getActive: function () {
    return this.root
  },

  addTree: function (node, before) {
    if (node.parent !== this.root) return;
    this.makeBlock(node.id, 0)
  },

  add: function (node, before, dontfocus) {
    if (node.parent === this.root) {
      var block = this.makeBlock(node.id, 0)
      block.node.style.zIndex = Object.keys(this.ids).length
      if (!dontfocus) {
        block.focus()
      }
      return
    }
    if (!this.ids[node.parent]) {
      return
    }
    this.ids[node.parent].addChild(node, this.model)
  },

  setCollapsed: function () {
  },
  startEditing: function () {
  },
  setActive: function () {
  },
  setSelection: function () {
  },
  move: function (id, pid, before, opid, lastchild) {
    if (this.ids[opid]) {
      this.ids[opid].removeChild(id)
    }
    if (this.ids[pid]) {
      return this.ids[pid].addChild(this.model.ids[id], id, before)
    }
    if (pid !== this.root) {
      return
    }
    this.add(this.model.ids[id], before)
  },
  remove: function (id) {
    console.warn("FIX??")
    this.container.removeChild(this.ids[id].node)
    delete this.ids[id]
  },
  goTo: function () {
    console.warn('FIX!');
  },
  clear: function () {
    for (var id in this.ids) {
      this.container.removeChild(this.ids[id].node)
    }
    this.ids = {}
    this.setContainerPos(0, 0)
    this.setContainerZoom(1);
  },

  rebase: function (newroot, trigger) {
    this.clear()
    this.root = newroot
    this.makeBlocks(newroot)
    this.ctrl.trigger('rebase', newroot)
  },

  setAttr: function (id, attr, value) {
    if (!this.ids[id]) {
      return
    }
    if (attr === 'whiteboard') {
      if (!value || !value.top) {
        var ch = this.model.ids[this.root].children
          , i = ch.indexOf(id)
          , defaultWidth = 300
          , defaultHeight = 100
          , margin = 10
        value = {
          top: 10 + parseInt(i / 4) * (defaultHeight + margin),
          left: 10 + (i % 4) * (defaultWidth + margin)
        }
      }
      this.ids[id].updateConfig(value)
    }
    // TODO something with done-ness?
  },

  setContent: function (id, content) {
    if (!this.ids[id]) {
      return
    }
    this.ids[id].setContent(content)
  },

  makeBlocks: function (root) {
    var children = this.model.ids[root].children
    if (!children) return
    children.forEach(this.makeBlock.bind(this));
  },

  makeBlock: function (id, i) {
    var node = this.model.ids[id]
      , config = node.meta.whiteboard
      // TODO: magic numbers?
      , defaultWidth = 300
      , defaultHeight = 100
      , margin = 10
    if (!config) {
      config = {
        // width: 200,
        // height: 200,
        top: 10 + parseInt(i / 4) * (defaultHeight + margin),
        left: 10 + (i % 4) * (defaultWidth + margin)
      }
    }
    var children = (node.children || []).map(function (id) {
      return this.model.ids[id]
    }.bind(this));
    var block = new Block(node, children, config, {
      saveConfig: function (config) {
        this.ctrl.executeCommands('changeNodeAttr', [node.id, 'whiteboard', config]);
      }.bind(this),
      saveContent: function (content) {
        this.ctrl.executeCommands('changeContent', [node.id, content]);
      }.bind(this),
      changeContent: function (content) {
        this.ctrl.executeCommands('changeContent', [node.id, content]);
      }.bind(this),
      startMoving: this._onStartMoving.bind(this, node.id),
      startMovingChild: this._onStartMovingChild.bind(this, node.id),
      onZoom: function () {
        this.rebase(node.id)
      }.bind(this),
    })
    this.ids[id] = block
    this.container.appendChild(block.node)
    return block
  },

  /**
   * If the current is over a target, show the drop shadow.
   */
  updateDropTarget: function (x, y) {
    var t
    /*
    if (this.moving.currentTarget) {
      t = this.moving.currentTarget
      if (x >= t.hit.left && x <= t.hit.right &&
          y >= t.hit.top && y <= t.hit.bottom) {
        // just keep the current one
        return
      }
    }
    */
    for (var i=0; i<this.moving.targets.length; i++) {
      t = this.moving.targets[i]
      if (x >= t.hit.left && x <= t.hit.right &&
          y >= t.hit.top && y <= t.hit.bottom) {
        this.moving.currentTarget = t
        this.showDropShadow(t.draw)
        return
      }
    }
    this.moving.currentTarget = null
    this.hideDropShadow()
  },

  /**
   * Collect a list of targets 
   */
  findTargets: function (children, id, isChild) {
    var targets = []
    for (var i = children.length - 1; i >= 0; i--) {
      if (id == children[i]) continue;
      targets = targets.concat(this.ids[children[i]].getDropTargets())
    }
    return targets
  },

  getByZIndex: function () {
    var items = [];
    for (var id in this.ids) {
      items.push([+this.ids[id].node.style.zIndex, id])
    }
    items.sort(function (a, b) {
      return a[0] - b[0]
    })
    return items.map(function (item) {return item[1]})
  },

  shuffleZIndices: function (top) {
    var items = this.getByZIndex()
    for (var i=0; i<items.length; i++) {
      this.ids[items[i]].node.style.zIndex = i
    }
    this.ids[top].node.style.zIndex = items.length
    return items
  },

  // event handlers

  _onClick: function (e) {
    if (e.target === this.rootNode) {
      document.activeElement.blur()
    }
  },

  _onDoubleClick: function (e) {
    if (e.target !== this.rootNode) {
      return
    }
    var box = this.container.getBoundingClientRect()
    var x = e.clientX - 50 - box.left
      , y = e.clientY - 10 - box.top
      , idx = this.model.ids[this.root].children.length
    this.ctrl.executeCommands('newNode', [this.root, idx, '', {
      whiteboard: {
        // width: 200,
        // height: 200,
        top: y,
        left: x
      }
    }]);
  },

  _onWheel: function (e) {
    e.preventDefault()
    if (this.moving) {
      return
    }
    var x, y
    if (e.shiftKey) {
      var root = this.rootNode.getBoundingClientRect()
      x = e.clientX - root.left
      y = e.clientY - root.top
      this.zoomMove((e.wheelDeltaY / 500), x, y)
      return
    }
    x = this.x
    y = this.y
    this.setContainerPos(x + e.wheelDeltaX, y + e.wheelDeltaY)
  },

  _onMouseDown: function (e) {
    if (e.target !== this.rootNode) {
      return
    }
    var box = this.container.getBoundingClientRect()
    var x = e.clientX/this._zoom - box.left/this._zoom
      , y = e.clientY/this._zoom - box.top/this._zoom
    this.moving = {
      x: x,
      y: y,
    }
    e.preventDefault()
    document.addEventListener('mousemove', this._boundMove)
    document.addEventListener('mouseup', this._boundUp)
  },

  _onStartMoving: function (id, e, rect, shiftMove) {
    if (this.moving) return false;
    var y = e.clientY / this._zoom - rect.top/this._zoom
      , x = e.clientX / this._zoom - rect.left/this._zoom
    var children = this.getByZIndex()
    var targets = this.findTargets(children, id)
    this.moving = {
      shift: shiftMove,
      targets: targets,
      id: id,
      x: x,
      y: y,
    }
    document.addEventListener('mousemove', this._boundMove)
    document.addEventListener('mouseup', this._boundUp)
    return true
  },

  _onStartMovingChild: function (id, e, cid, handle, shiftMove) {
    if (this.moving) return false;
    var box = this.container.getBoundingClientRect()
    var x = e.clientX/this._zoom - box.left/this._zoom
      , y = e.clientY/this._zoom - box.top/this._zoom
    var children = this.shuffleZIndices(id)
    var targets = this.findTargets(children, cid, true)
    this.moving = {
      shift: shiftMove,
      targets: targets,
      handle: handle,
      child: cid,
      parent_id: id,
      x: x,
      y: y
    }
    this.container.appendChild(handle)
    handle.className = 'whiteboard_child-handle'
    handle.style.top = y + 'px'
    handle.style.left = x + 'px'
    document.addEventListener('mousemove', this._boundMove)
    document.addEventListener('mouseup', this._boundUp)
    return true
  },

  _onKeyUp: function (e) {
    if (e.keyCode === 16 && this.moving && this.moving.shift) {
      this.stopMoving()
    }
  },

  _onMouseMove: function (e) {
    if (!this.moving) {
      return this._onMouseUp(e)
    }
    e.preventDefault()
    if (this.moving.child) {
      var box = this.container.getBoundingClientRect()
      var x = e.clientX/this._zoom - box.left/this._zoom
        , y = e.clientY/this._zoom - box.top/this._zoom
      this.moving.handle.style.top = y + 'px'
      this.moving.handle.style.left = x + 'px'
      this.moving.x = x
      this.moving.y = y
      this.updateDropTarget(e.clientX, e.clientY)
      return false
    }

    if (this.moving.id) {
      var box = this.container.getBoundingClientRect()
      var x = e.clientX/this._zoom - box.left/this._zoom - this.moving.x
        , y = e.clientY/this._zoom - box.top/this._zoom - this.moving.y
      this.ids[this.moving.id].reposition(x, y, true)
      this.updateDropTarget(e.clientX, e.clientY)
      return false
    } 

    // dragging the canvas
    var box = this.rootNode.getBoundingClientRect()
    var x = (e.clientX)/this._zoom - box.left/this._zoom - this.moving.x
      , y = (e.clientY)/this._zoom - box.top/this._zoom - this.moving.y
    this.setContainerPos(x, y)
    return false
  },

  _onMouseUp: function (e) {
    e.preventDefault()
    this.stopMoving()
    return false
  },

  resetContainer: function () {
    this.setContainerPos(0, 0)
    this.setContainerZoom(1)
  },

  resetPositions: function () {
    var cmds = []
    this.model.ids[this.root].children.forEach(function (id) {
      cmds.push('changeNodeAttr')
      cmds.push([id, 'whiteboard', null])
    });
    this.ctrl.executeCommands(cmds)
  },

  zoomMove: function (delta, x, y) {
    var next = this._zoom * delta
      , nz = this._zoom + next
      , scale = this._zoom / nz
      , nx = x - x / scale
      , ny = y - y / scale
    this.setContainerPos(this.x/scale + nx, this.y/scale + ny)
    this.setContainerZoom(nz)
  },

  setContainerZoom: function (num) {
    this._zoom = num
    this.container.style.WebkitTransform = 'scale(' + num + ')'
  },

  setContainerPos: function (x, y) {
    this.x = x
    this.y = y
    this.container.style.left = x + 'px'
    this.container.style.top = y + 'px'
  },

  // other stuff

  stopMovingChild: function () {
    // TODO move into
    this.moving.handle.parentNode.removeChild(this.moving.handle)
    var pos = this.model.ids[this.root].children.length

    this.ctrl.executeCommands('changeNodeAttr', [
      this.moving.child,
      'whiteboard',
      {top: this.moving.y, left: this.moving.x}
    ]);

    this.ctrl.executeCommands('move', [
      this.moving.child,
      this.root,
      pos
    ])
    this.ids[this.moving.parent_id].doneMoving()
  },

  showDropShadow: function (rect) {
    var box = this.rootNode.getBoundingClientRect()
    this.dropShadow.style.top = rect.top - box.top + 'px'
    this.dropShadow.style.left = rect.left - box.left + 'px'
    this.dropShadow.style.width = rect.width + 'px'
    this.dropShadow.style.height = rect.height + 'px'
    this.dropShadow.style.display = 'block'
  },

  hideDropShadow: function () {
    this.dropShadow.style.display = 'none'
  },

  stopMoving: function () {
    if (this.moving.child) {
      this.stopMovingChild()
    } else if (this.moving.id) {
      this.ids[this.moving.id].doneMoving()
    }
    if (this.moving.currentTarget) {
      this.hideDropShadow()
    }
    this.moving = null
    document.removeEventListener('mousemove', this._boundMove)
    document.removeEventListener('mouseup', this._boundUp)
  },

  getNode: function () {
    return this.rootNode
  }
}

