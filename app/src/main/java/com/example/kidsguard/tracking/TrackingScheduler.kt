package com.example.kidsguard.tracking

interface TrackingScheduler {
    fun start()
    fun stop()
    fun pause()
    fun resume()
    fun setInterval(seconds: Long)
}

class LocalTrackingScheduler : TrackingScheduler {
    override fun start() {
        // Future implementation
    }

    override fun stop() {
        // Future implementation
    }

    override fun pause() {
        // Future implementation
    }

    override fun resume() {
        // Future implementation
    }

    override fun setInterval(seconds: Long) {
        // Future implementation
    }
}
