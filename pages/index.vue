<template>
  <!-- Joshua -->
  <main class="page">
    <MapPage />
  </main>
</template>

<style scoped>
.page {
  /* 地圖是滿版面元件，這裡不要再用 grid 置中，容易造成捲軸或多餘留白，並讓拖拽體驗怪怪的。 */
  width: 100vw;
  height: 100vh;
  margin: 0;
  overflow: hidden;
}
</style>
