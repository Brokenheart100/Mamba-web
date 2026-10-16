<script setup lang="ts">
defineProps<{ error: { statusCode: number; message: string } }>();
</script>
<template>
  <div class="standalone-error">
    <span class="eyebrow">A BRIEF INTERMISSION</span>
    <h1>
      {{
        error.statusCode === 404 ? "这一页，暂时还没有故事。" : "放映暂时中断。"
      }}
    </h1>
    <p>
      {{
        error.statusCode === 404
          ? "链接可能有误，回到首页发现新的番剧吧。"
          : "可以稍后重试，观看记录仍保存在本地。"
      }}
    </p>
    <button class="button primary" @click="clearError({ redirect: '/' })">
      返回首页
    </button>
  </div>
</template>
