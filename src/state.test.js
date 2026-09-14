import test from 'node:test';
import assert from 'node:assert/strict';
import {createDevices,applyScene,power,restore} from './state.js';
test('每台设备标识唯一，客厅三盏灯可以独立控制',()=>{const devices=createDevices();assert.equal(new Set(devices.map(d=>d.id)).size,24);const lamps=devices.filter(d=>d.room==='living'&&d.type==='light');assert.equal(lamps.length,3);lamps[0].on=false;assert(lamps[1].on);});
test('离家关闭非必要设备，保留冰箱与热水器原状态',()=>{const devices=createDevices();const next=applyScene(devices,'away');assert(next.filter(d=>!['fridge','heater'].includes(d.type)).every(d=>!d.on&&!d.running));assert(next.find(d=>d.type==='fridge').on);assert(devices[0].on);});
test('松弛夜晚仅保留两盏45%亮度的灯',()=>{const lit=applyScene(createDevices(),'relax').filter(d=>d.type==='light'&&d.on);assert.deepEqual(lit.map(d=>d.id),['floor-light','b-bed']);assert(lit.every(d=>d.brightness===45));});
test('状态恢复忽略异常记录与几何属性，限制参数边界',()=>{const next=restore(createDevices(),[null,{id:'living-main',name:'错误',x:999,brightness:999,on:false}]);assert.equal(next[0].name,'客厅吊灯');assert.equal(next[0].x,7.3);assert.equal(next[0].brightness,100);assert.equal(next[0].on,false);});
test('模拟灯光功率随亮度变化',()=>{assert.equal(power([{on:true,type:'light',watts:20,brightness:50},{on:false,watts:900}]),10);});
