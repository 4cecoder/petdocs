-keepattributes *Annotation*, InnerClasses
-dontwarn kotlinx.serialization.**
-keepclassmembers class ** {
    @kotlinx.serialization.Serializable <fields>;
}
