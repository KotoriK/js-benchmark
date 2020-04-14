/**
 * 测试set和array的添加元素性能。结论就是没有必要不要用shift。看来array并不能当Queue的js版？
 * 
 * @author KotoriK
 * @param {*} times
 */
function test(times) {
    var a = new Set(),
        b = [],
        c = [],
        d = []
    console.time('set add')
    for (let i = 0; i < times; i++) {
        a.add(i)
    }
    console.timeEnd('set add')

    console.time('array push')
    for (let i = 0; i < times; i++) {
        b.push(i)
    }
    console.timeEnd('array push')

    console.time('array unshift')
    for (let i = 0; i < times; i++) {
        c.unshift(i)
    }
    console.timeEnd('array unshift')

    console.time('array [i]=i')
    for (let i = 0; i < times; i++) {
        d[i] = i
    }
    console.timeEnd('array [i]=i')
    console.warn(a)
    console.warn(b)
    console.warn(c)
    console.warn(d)
    //get last
    let last
    console.time('set getLast')
    for (let i = 0; i < times; i++) {
       last= (()=>{
           let count=0,target=a.size-1
           for(const i of a.values()){
               if(count==target)return i
               count++
           }
        })()
        
    }
    console.timeEnd('set getLast')
    console.log(last)
    //array
    console.time('array getLast')
    for (let i = 0; i < times; i++) {
       last= (()=>{
            
        return b[b.length-1]
        })()
        
    }
    console.timeEnd('array getLast')
    console.log(last)
    //
    setTimeout(() => {
        console.time('set delete')
        for (let i = 0; i < times; i++) {
            a.delete(i)
        }
        console.timeEnd('set delete')

        console.time('array pop')
        for (let i = 0; i < times; i++) {
            b.pop()
        }
        console.timeEnd('array pop')

        console.time('array shift')
        for (let i = 0; i < times; i++) {
            c.shift()
        }
        console.timeEnd('array shift')

        /* console.time('array [i]=i')
        for (let i = 0; i < times; i++) {
            d[i] = i
        }
        console.timeEnd('array [i]=i') */

    }, 200)
}
/* test(100000)
VM228:10 set add: 9.45703125ms
VM228:16 array push: 3.874267578125ms
VM228:22 array unshift: 753.305908203125ms
VM228:28 array [i]=i: 3.43603515625ms
VM228:35 set delete: 10.842041015625ms
VM228:41 array pop: 2.505126953125ms
VM228:47 array shift: 711.339111328125ms */
/* test(100000)
VM228:10 set add: 12.144775390625ms
VM228:16 array push: 1.68603515625ms
VM228:22 array unshift: 748.301025390625ms
VM228:28 array [i]=i: 1.877197265625ms
undefined
VM228:35 set delete: 10.614013671875ms
VM228:41 array pop: 0.25927734375ms
VM228:47 array shift: 709.9248046875ms */