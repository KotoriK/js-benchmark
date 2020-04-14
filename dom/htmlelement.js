/**
 * 测试创建AudioElement，修改他们的属性，以及删除他们所需要的时间。应该看第一个属性就够了，就是创建HTMLElement是真的开销很大
 *
 * @author KotoriK
 */
function startTest(testUrl) {
    fetch(testUrl, {
            method: 'get'
        })
        .then(async (response) => {
            return URL.createObjectURL(await response.blob())
        }).then((url) => {
            var array = []
            console.time('create')
            create(array, 5000)
            console.timeEnd('create')
            console.time('modify')
            modify(array, url)
            console.timeEnd('modify')
            let array2 = [...array]
            console.time('deleteGC')

            deleteGC(array)
            console.timeEnd('deleteGC')

            console.time('deleteNull')
            deleteNull(array2)
            console.timeEnd('deleteNull')
        })

}




function create(array, eleNum) {
    for (let i = 0; i < eleNum; i++) {
        array.push(document.createElement('audio'))

    }
}

function modify(array, url) {
    for (const i of array) {
        i.src = url
    }
}

function deleteGC(array) {
    while (array.length > 0) {
        array.shift()
    }
}

function deleteNull(array) {
    for (let i = 0; i < array.length; i++) {
        array[i] = null
    }
}